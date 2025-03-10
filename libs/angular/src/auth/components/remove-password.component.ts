import { Directive, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { KeyConnectorService } from "@bitwarden/common/auth/abstractions/key-connector.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
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
      throw new Error("No active account found");
    }
    this.activeUserId = activeAccount.id;

    this.organization = await this.keyConnectorService.getManagingOrganization(this.activeUserId);
    if (this.organization == null) {
      throw new Error("No organization found");
    }
    await this.syncService.fullSync(false);
    this.loading = false;
  }

  get action() {
    return this.continuing || this.leaving;
  }

  convert = async () => {
    this.continuing = true;

    try {
      await this.keyConnectorService.migrateUser(this.activeUserId);

      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("removedMasterPassword"),
      });
      await this.keyConnectorService.removeConvertAccountRequired(this.activeUserId);

      await this.router.navigate([""]);
    } catch (e) {
      this.continuing = false;

      if (e instanceof Error) {
        this.toastService.showToast({
          variant: "error",
          title: this.i18nService.t("errorOccurred"),
          message: e.message,
        });
      }
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
      await this.keyConnectorService.removeConvertAccountRequired(this.activeUserId);

      await this.router.navigate([""]);
    } catch (e) {
      this.leaving = false;

      if (e instanceof Error) {
        this.toastService.showToast({
          variant: "error",
          title: this.i18nService.t("errorOccurred"),
          message: e.message,
        });
      }
    }
  };
}
