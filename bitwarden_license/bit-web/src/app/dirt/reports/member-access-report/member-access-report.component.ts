// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { BehaviorSubject, debounceTime, firstValueFrom, lastValueFrom } from "rxjs";

import { UserNamePipe } from "@bitwarden/angular/pipes/user-name.pipe";
import { safeProvider } from "@bitwarden/angular/platform/utils/safe-provider";
import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions";
import { OrganizationMetadataServiceAbstraction } from "@bitwarden/common/billing/abstractions/organization-metadata.service.abstraction";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { DialogService, SearchModule, TableDataSource } from "@bitwarden/components";
import { ExportHelper } from "@bitwarden/vault-export-core";
import { CoreOrganizationModule } from "@bitwarden/web-vault/app/admin-console/organizations/core";
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

@Component({
  selector: "member-access-report",
  templateUrl: "member-access-report.component.html",
  imports: [SharedModule, SearchModule, HeaderModule, CoreOrganizationModule],
  providers: [
    safeProvider({
      provide: MemberAccessReportServiceAbstraction,
      useClass: MemberAccessReportService,
      deps: [MemberAccessReportApiService, I18nService],
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
  ) {
    // Connect the search input to the table dataSource filter input
    this.searchControl.valueChanges
      .pipe(debounceTime(200), takeUntilDestroyed())
      .subscribe((v) => (this.dataSource.filter = v));
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
