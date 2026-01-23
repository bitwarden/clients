// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, DestroyRef, inject, OnInit, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { BehaviorSubject, debounceTime, firstValueFrom, lastValueFrom, skip } from "rxjs";

import {
  CollectionAdminService,
  OrganizationUserApiService,
} from "@bitwarden/admin-console/common";
import { UserNamePipe } from "@bitwarden/angular/pipes/user-name.pipe";
import { safeProvider } from "@bitwarden/angular/platform/utils/safe-provider";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions";
import { OrganizationMetadataServiceAbstraction } from "@bitwarden/common/billing/abstractions/organization-metadata.service.abstraction";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { DialogService, SearchModule, TableDataSource } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";
import { ExportHelper } from "@bitwarden/vault-export-core";
import { CoreOrganizationModule } from "@bitwarden/web-vault/app/admin-console/organizations/core";
import { GroupApiService } from "@bitwarden/web-vault/app/admin-console/organizations/core/services/group/group-api.service";
import {
  openUserAddEditDialog,
  MemberDialogResult,
  MemberDialogTab,
} from "@bitwarden/web-vault/app/admin-console/organizations/members/components/member-dialog";
import { exportToCSV } from "@bitwarden/web-vault/app/dirt/reports/report-utils";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

import { MemberAccessLoadingComponent } from "./member-access-loading.component";
import { MemberAccessProgress, MemberAccessProgressState } from "./model/member-access-progress";
import { MemberAccessReportServiceAbstraction } from "./services/member-access-report.abstraction";
import { MemberAccessReportService } from "./services/member-access-report.service";
import { userReportItemHeaders } from "./view/member-access-export.view";
import { MemberAccessReportView } from "./view/member-access-report.view";

/** Minimum time (ms) to display each progress step for smooth UX */
const STEP_DISPLAY_DELAY_MS = 250;

type ProgressStep = MemberAccessProgressState | null;

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "member-access-report",
  templateUrl: "member-access-report.component.html",
  imports: [
    SharedModule,
    SearchModule,
    HeaderModule,
    CoreOrganizationModule,
    MemberAccessLoadingComponent,
  ],
  providers: [
    safeProvider({
      provide: MemberAccessReportServiceAbstraction,
      useClass: MemberAccessReportService,
      deps: [
        I18nService,
        EncryptService,
        KeyService,
        AccountService,
        OrganizationUserApiService,
        CollectionAdminService,
        GroupApiService,
        ApiService,
      ],
    }),
  ],
})
export class MemberAccessReportComponent implements OnInit {
  protected dataSource = new TableDataSource<MemberAccessReportView>();
  protected searchControl = new FormControl("", { nonNullable: true });
  protected organizationId: OrganizationId;
  protected orgIsOnSecretsManagerStandalone: boolean;
  protected isLoading$ = new BehaviorSubject(true);

  /** Current progress state for the loading component */
  protected readonly currentProgressStep = signal<ProgressStep>(null);

  private destroyRef = inject(DestroyRef);

  constructor(
    private route: ActivatedRoute,
    protected reportService: MemberAccessReportService,
    protected fileDownloadService: FileDownloadService,
    protected dialogService: DialogService,
    protected userNamePipe: UserNamePipe,
    protected billingApiService: BillingApiServiceAbstraction,
    protected organizationMetadataService: OrganizationMetadataServiceAbstraction,
  ) {
    // Connect the search input to the table dataSource filter input
    this.searchControl.valueChanges
      .pipe(debounceTime(200), takeUntilDestroyed())
      .subscribe((v) => (this.dataSource.filter = v));

    // Subscribe to progress updates
    // Use simple subscription - the service batches ProcessingMembers updates
    this.reportService.progress$
      .pipe(
        skip(1), // Skip initial null emission from BehaviorSubject
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((state) => {
        if (state?.step === MemberAccessProgress.Complete) {
          // Show complete briefly, then hide loading
          this.currentProgressStep.set(state);
          setTimeout(() => this.currentProgressStep.set(null), STEP_DISPLAY_DELAY_MS);
        } else {
          this.currentProgressStep.set(state);
        }
      });
  }

  async ngOnInit() {
    this.isLoading$.next(true);

    const params = await firstValueFrom(this.route.params);
    this.organizationId = params.organizationId;

    const billingMetadata = await firstValueFrom(
      this.organizationMetadataService.getOrganizationMetadata$(this.organizationId),
    );

    this.orgIsOnSecretsManagerStandalone = billingMetadata.isOnSecretsManagerStandalone;

    await this.load();

    this.isLoading$.next(false);
  }

  async load() {
    this.dataSource.data = await this.reportService.generateMemberAccessReportView(
      this.organizationId,
    );
  }

  exportReportAction = async (): Promise<void> => {
    this.fileDownloadService.download({
      fileName: ExportHelper.getFileName("member-access"),
      blobData: exportToCSV(
        await this.reportService.generateUserReportExportItems(this.organizationId),
        userReportItemHeaders,
      ),
      blobOptions: { type: "text/plain" },
    });
  };

  edit = async (user: MemberAccessReportView): Promise<void> => {
    const dialog = openUserAddEditDialog(this.dialogService, {
      data: {
        kind: "Edit",
        name: this.userNamePipe.transform(user),
        organizationId: this.organizationId,
        organizationUserId: user.userGuid,
        usesKeyConnector: user.usesKeyConnector,
        isOnSecretsManagerStandalone: this.orgIsOnSecretsManagerStandalone,
        initialTab: MemberDialogTab.Role,
      },
    });

    const result = await lastValueFrom(dialog.closed);
    switch (result) {
      case MemberDialogResult.Deleted:
      case MemberDialogResult.Saved:
      case MemberDialogResult.Revoked:
      case MemberDialogResult.Restored:
        await this.load();
        return;
    }
  };
}
