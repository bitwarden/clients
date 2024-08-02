import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom, map } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { UserId } from "@bitwarden/common/types/guid";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";

import { ToastService } from "../../../../components/src/toast";
import { InputPasswordComponent } from "../input-password/input-password.component";
import { PasswordInputResult } from "../input-password/password-input-result";

import {
  SetPasswordCredentials,
  SetPasswordJitService,
} from "./set-password-jit.service.abstraction";

@Component({
  standalone: true,
  selector: "auth-set-password-jit",
  templateUrl: "set-password-jit.component.html",
  imports: [CommonModule, InputPasswordComponent, JslibModule],
})
export class SetPasswordJitComponent implements OnInit {
  protected email: string;
  protected masterPasswordPolicyOptions: MasterPasswordPolicyOptions;
  protected orgId: string;
  protected orgSsoIdentifier: string;
  protected resetPasswordAutoEnroll: boolean;
  protected submitting = false;
  protected syncLoading = true;
  protected userId: UserId;

  constructor(
    private accountService: AccountService,
    private activatedRoute: ActivatedRoute,
    private i18nService: I18nService,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private policyApiService: PolicyApiServiceAbstraction,
    private router: Router,
    private setPasswordJitService: SetPasswordJitService,
    private syncService: SyncService,
    private toastService: ToastService,
    private validationService: ValidationService,
  ) {}

  async ngOnInit() {
    this.email = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((a) => a?.email)),
    );

    await this.syncService.fullSync(true);
    this.syncLoading = false;

    await this.handleQueryParams();
  }

  private async handleQueryParams() {
    const qParams = await firstValueFrom(this.activatedRoute.queryParams);

    if (qParams.identifier != null) {
      try {
        this.orgSsoIdentifier = qParams.identifier;

        const autoEnrollStatus = await this.organizationApiService.getAutoEnrollStatus(
          this.orgSsoIdentifier,
        );
        this.orgId = autoEnrollStatus.id;
        this.resetPasswordAutoEnroll = autoEnrollStatus.resetPasswordEnabled;
        this.masterPasswordPolicyOptions =
          await this.policyApiService.getMasterPasswordPolicyOptsForOrgUser(autoEnrollStatus.id);
      } catch {
        this.toastService.showToast({
          variant: "error",
          title: null,
          message: this.i18nService.t("errorOccurred"),
        });
      }
    }
  }

  protected async handlePasswordFormSubmit(passwordInputResult: PasswordInputResult) {
    this.submitting = true;

    const userId = (await firstValueFrom(this.accountService.activeAccount$))?.id;

    const credentials: SetPasswordCredentials = {
      ...passwordInputResult,
      orgSsoIdentifier: this.orgSsoIdentifier,
      orgId: this.orgId,
      resetPasswordAutoEnroll: this.resetPasswordAutoEnroll,
      userId,
    };

    try {
      await this.setPasswordJitService.setPassword(credentials);
    } catch (e) {
      this.validationService.showError(e);
      this.submitting = false;
      return;
    }

    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("accountSuccessfullyCreated"),
    });

    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("inviteAccepted"),
    });

    this.submitting = false;

    await this.router.navigate(["vault"]);
  }
}
