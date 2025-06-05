import { Directive, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { KeyConnectorService } from "@bitwarden/common/key-management/key-connector/abstractions/key-connector.service";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { DialogService, ToastService } from "@bitwarden/components";

@Directive()
export class RemovePasswordComponent implements OnInit {
  continuing = false;
  leaving = false;

  loading = true;
  organization!: Organization;
  private activeUserId!: UserId;

  constructor(
    private logService: LogService,
    private router: Router,
    private accountService: AccountService,
    private syncService: SyncService,
    private i18nService: I18nService,
    private keyConnectorService: KeyConnectorService,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private dialogService: DialogService,
    private toastService: ToastService,
  ) {}

  async ngOnInit() {
    const activeAccount = await firstValueFrom(this.accountService.activeAccount$);
    if (activeAccount == null) {
      this.logService.info(
        "[Key Connector remove password] No active account found, redirecting to login.",
      );
      await this.router.navigate(["/"]);
      return;
    }
    this.activeUserId = activeAccount.id;

    await this.syncService.fullSync(false);

    this.organization = await this.keyConnectorService.getManagingOrganization(this.activeUserId);
    if (this.organization == null) {
      this.logService.info(
        "[Key Connector remove password] No organization found, redirecting to login.",
      );
      await this.router.navigate(["/"]);
      return;
    }
    this.loading = false;
  }

  get action() {
    return this.continuing || this.leaving;
  }

  convert = async () => {
    this.continuing = true;

    try {
      await this.keyConnectorService.migrateUser(
        this.organization.keyConnectorUrl,
        this.activeUserId,
      );

      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("removedMasterPassword"),
      });

      await this.router.navigate(["/"]);
    } catch (e) {
      this.continuing = false;

      this.handleActionError(e);
    }
  };

  leave = async () => {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: this.organization.name,
      content: { key: "leaveOrganizationConfirmation" },
      type: "warning",
    });

    if (!confirmed) {
      return false;
    }

    this.leaving = true;
    try {
      await this.organizationApiService.leave(this.organization.id);

      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("leftOrganization"),
      });

      await this.router.navigate(["/"]);
    } catch (e) {
      this.leaving = false;

      this.handleActionError(e);
    }
  };

  handleActionError(e: unknown) {
    let message = "";
    if (e instanceof ErrorResponse || e instanceof Error) {
      message = e.message;
    }

    this.toastService.showToast({
      variant: "error",
      title: this.i18nService.t("errorOccurred"),
      message: message,
    });
  }
}
