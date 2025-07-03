// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, OnDestroy, OnInit, Inject, Input } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";
import { switchMap, takeUntil } from "rxjs";

import { ChangePasswordComponent } from "@bitwarden/angular/auth/components/change-password.component";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  DialogConfig,
  DialogRef,
  DIALOG_DATA,
  DialogService,
  ToastService,
} from "@bitwarden/components";
import { KdfType, KdfConfigService, KeyService } from "@bitwarden/key-management";

import { EmergencyAccessService } from "../../../emergency-access";

// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum EmergencyAccessTakeoverResultType {
  Done = "done",
}
type EmergencyAccessTakeoverDialogData = {
  /** display name of the account requesting emergency access takeover */
  name: string;
  /** email of the account requesting emergency access takeover */
  email: string;
  /** traces a unique emergency request  */
  emergencyAccessId: string;
};
@Component({
  selector: "emergency-access-takeover",
  templateUrl: "emergency-access-takeover.component.html",
  standalone: false,
})
export class EmergencyAccessTakeoverComponent
  extends ChangePasswordComponent
  implements OnInit, OnDestroy
{
  @Input() kdf: KdfType;
  @Input() kdfIterations: number;
  takeoverForm = this.formBuilder.group({
    masterPassword: ["", [Validators.required]],
    masterPasswordRetype: ["", [Validators.required]],
  });

  constructor(
    @Inject(DIALOG_DATA) protected params: EmergencyAccessTakeoverDialogData,
    private formBuilder: FormBuilder,
    i18nService: I18nService,
    keyService: KeyService,
    messagingService: MessagingService,
    platformUtilsService: PlatformUtilsService,
    policyService: PolicyService,
    private emergencyAccessService: EmergencyAccessService,
    private logService: LogService,
    dialogService: DialogService,
    private dialogRef: DialogRef<EmergencyAccessTakeoverResultType>,
    kdfConfigService: KdfConfigService,
    masterPasswordService: InternalMasterPasswordServiceAbstraction,
    accountService: AccountService,
    protected toastService: ToastService,
  ) {
    super(
      accountService,
      dialogService,
      i18nService,
      kdfConfigService,
      keyService,
      masterPasswordService,
      messagingService,
      platformUtilsService,
      policyService,
      toastService,
    );
  }

  async ngOnInit() {
    const policies = await this.emergencyAccessService.getGrantorPolicies(
      this.params.emergencyAccessId,
    );
    this.accountService.activeAccount$
      .pipe(
        getUserId,
        switchMap((userId) => this.policyService.masterPasswordPolicyOptions$(userId, policies)),
        takeUntil(this.destroy$),
      )
      .subscribe((enforcedPolicyOptions) => (this.enforcedPolicyOptions = enforcedPolicyOptions));
  }

  ngOnDestroy(): void {
    super.ngOnDestroy();
  }

  submit = async () => {
    if (this.takeoverForm.invalid) {
      this.takeoverForm.markAllAsTouched();
      return;
    }
    this.masterPassword = this.takeoverForm.get("masterPassword").value;
    this.masterPasswordRetype = this.takeoverForm.get("masterPasswordRetype").value;
    if (!(await this.strongPassword())) {
      return;
    }

    try {
      await this.emergencyAccessService.takeover(
        this.params.emergencyAccessId,
        this.masterPassword,
        this.params.email,
      );
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("unexpectedError"),
      });
    }
    this.dialogRef.close(EmergencyAccessTakeoverResultType.Done);
  };
  /**
   * Strongly typed helper to open a EmergencyAccessTakeoverComponent
   * @param dialogService Instance of the dialog service that will be used to open the dialog
   * @param config Configuration for the dialog
   */
  static open = (
    dialogService: DialogService,
    config: DialogConfig<EmergencyAccessTakeoverDialogData>,
  ) => {
    return dialogService.open<EmergencyAccessTakeoverResultType>(
      EmergencyAccessTakeoverComponent,
      config,
    );
  };
}
