// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl } from "@angular/forms";
import { ActivatedRoute } from "@angular/router";
import { BehaviorSubject, debounceTime, firstValueFrom, lastValueFrom } from "rxjs";

import { UserNamePipe } from "@bitwarden/angular/pipes/user-name.pipe";
import { safeProvider } from "@bitwarden/angular/platform/utils/safe-provider";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { BillingApiServiceAbstraction } from "@bitwarden/common/billing/abstractions";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { BadgeModule, DialogService, SearchModule, TableDataSource } from "@bitwarden/components";
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
  imports: [SharedModule, SearchModule, HeaderModule, CoreOrganizationModule, BadgeModule],
  providers: [
    safeProvider({
      provide: MemberAccessReportServiceAbstraction,
      useClass: MemberAccessReportService,
      deps: [MemberAccessReportApiService, I18nService],
    }),
  ],
  standalone: true,
})
export class MemberAccessReportComponent implements OnInit {
  protected dataSource = new TableDataSource<MemberAccessReportView>();
  protected searchControl = new FormControl("", { nonNullable: true });
  protected organizationId: OrganizationId;
  protected orgIsOnSecretsManagerStandalone: boolean;
  protected isLoading$ = new BehaviorSubject(true);

  // Statistics for the cards
  protected totalMembers = 0;
  protected membersWithTwoStepLogin = 0;
  protected membersWithAccountRecovery = 0;
  protected totalPurchasedSeats = 0;
  protected membersWithItems = 0;

  constructor(
    private route: ActivatedRoute,
    protected reportService: MemberAccessReportService,
    protected fileDownloadService: FileDownloadService,
    protected dialogService: DialogService,
    protected userNamePipe: UserNamePipe,
    protected billingApiService: BillingApiServiceAbstraction,
    protected organizationApiService: OrganizationApiServiceAbstraction,
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

    const billingMetadata = await this.billingApiService.getOrganizationBillingMetadata(
      this.organizationId,
    );

    this.orgIsOnSecretsManagerStandalone = billingMetadata.isOnSecretsManagerStandalone;

    // Get organization details to get seat information
    const orgResponse = await this.organizationApiService.get(this.organizationId);
    this.totalPurchasedSeats = orgResponse.seats || 0;

    await this.load();

    this.isLoading$.next(false);
  }

  async load() {
    const data = await this.reportService.generateMemberAccessReportView(this.organizationId);

    this.dataSource.data = data;

    // Calculate statistics for the cards
    this.totalMembers = data.length;
    this.membersWithTwoStepLogin = data.filter((member) => member.twoFactorEnabled).length;
    this.membersWithAccountRecovery = data.filter((member) => member.accountRecoveryEnabled).length;
    this.membersWithItems = data.filter((member) => member.itemsCount > 0).length;
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
