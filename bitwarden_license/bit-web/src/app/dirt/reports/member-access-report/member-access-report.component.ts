// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { BehaviorSubject, debounceTime, firstValueFrom, lastValueFrom } from "rxjs";

import {
  CollectionAdminService,
  OrganizationUserApiService,
} from "@bitwarden/admin-console/common";
import { UserNamePipe } from "@bitwarden/angular/pipes/user-name.pipe";
import { safeProvider } from "@bitwarden/angular/platform/utils/safe-provider";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions";
import { OrganizationMetadataServiceAbstraction } from "@bitwarden/common/billing/abstractions/organization-metadata.service.abstraction";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import {
  DialogService,
  SearchModule,
  TableDataSource,
  IconModule,
  ToastService,
} from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";
import { ExportHelper } from "@bitwarden/vault-export-core";
import {
  CoreOrganizationModule,
  GroupApiService,
} from "@bitwarden/web-vault/app/admin-console/organizations/core";
import {
  openUserAddEditDialog,
  MemberDialogResult,
  MemberDialogTab,
} from "@bitwarden/web-vault/app/admin-console/organizations/members/components/member-dialog";
import { exportToCSV } from "@bitwarden/web-vault/app/dirt/reports/report-utils";
import { HeaderModule } from "@bitwarden/web-vault/app/layouts/header/header.module";
import { SharedModule } from "@bitwarden/web-vault/app/shared";

import { MemberAccessReportApiService } from "./services/member-access-report-api.service";
import { MemberAccessReportServiceAbstraction } from "./services/member-access-report.abstraction";
import { MemberAccessReportService } from "./services/member-access-report.service";
import { userReportItemHeaders } from "./view/member-access-export.view";
import { MemberAccessReportView } from "./view/member-access-report.view";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "member-access-report",
  templateUrl: "member-access-report.component.html",
  imports: [SharedModule, SearchModule, HeaderModule, CoreOrganizationModule, IconModule],
  providers: [
    safeProvider({
      provide: MemberAccessReportServiceAbstraction,
      useClass: MemberAccessReportService,
      deps: [
        MemberAccessReportApiService,
        I18nService,
        EncryptService,
        KeyService,
        AccountService,
        // V2 dependencies
        CollectionAdminService,
        OrganizationUserApiService,
        CipherService,
        LogService,
        GroupApiService,
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

  constructor(
    private route: ActivatedRoute,
    protected reportService: MemberAccessReportService,
    protected fileDownloadService: FileDownloadService,
    protected dialogService: DialogService,
    protected userNamePipe: UserNamePipe,
    protected billingApiService: BillingApiServiceAbstraction,
    protected organizationMetadataService: OrganizationMetadataServiceAbstraction,
    private logService: LogService,
    private toastService: ToastService,
    private i18nService: I18nService,
  ) {
    // Connect the search input to the table dataSource filter input
    this.searchControl.valueChanges
      .pipe(debounceTime(200), takeUntilDestroyed())
      .subscribe((v) => (this.dataSource.filter = v));
  }

  async ngOnInit() {
    this.isLoading$.next(true);

    try {
      const params = await firstValueFrom(this.route.params);
      this.organizationId = params.organizationId;

      // Handle billing metadata with fallback
      try {
        const billingMetadata = await firstValueFrom(
          this.organizationMetadataService.getOrganizationMetadata$(this.organizationId),
        );
        this.orgIsOnSecretsManagerStandalone = billingMetadata.isOnSecretsManagerStandalone;
      } catch (billingError: unknown) {
        // Log but don't block - billing metadata is not critical for report
        this.logService.warning(
          "[MemberAccessReportComponent] Failed to load billing metadata, using defaults",
          billingError,
        );
        this.orgIsOnSecretsManagerStandalone = false;
      }

      await this.load();
    } catch (error: unknown) {
      this.logService.error(
        "[MemberAccessReportComponent] Failed to load member access report",
        error,
      );
      this.toastService.showToast({
        variant: "error",
        title: "",
        message: this.i18nService.t("memberAccessReportLoadError"),
      });
      // Set empty data so table doesn't break
      this.dataSource.data = [];
    } finally {
      this.isLoading$.next(false);
    }
  }

  async load() {
    try {
      const reportData = await this.reportService.generateMemberAccessReportViewV2(
        this.organizationId,
      );
      this.dataSource.data = reportData;
    } catch (error) {
      this.logService.error("[MemberAccessReportComponent] Report generation failed", error);
      throw error;
    }
  }

  exportReportAction = async (): Promise<void> => {
    const exportItems = await this.reportService.generateUserReportExportItemsV2(
      this.organizationId,
    );

    this.fileDownloadService.download({
      fileName: ExportHelper.getFileName("member-access"),
      blobData: exportToCSV(exportItems, userReportItemHeaders),
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
