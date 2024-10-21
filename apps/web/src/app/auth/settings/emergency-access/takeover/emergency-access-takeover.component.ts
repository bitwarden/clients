import { DialogConfig, DialogRef, DIALOG_DATA } from "@angular/cdk/dialog";
import { Component, OnDestroy, OnInit, Inject, Input } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";
import { takeUntil } from "rxjs";

import { ChangePasswordComponent } from "@bitwarden/angular/auth/components/change-password.component";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { KdfConfigService } from "@bitwarden/common/auth/abstractions/kdf-config.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/auth/abstractions/master-password.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { KdfType } from "@bitwarden/common/platform/enums";
import { DialogService, ToastService } from "@bitwarden/components";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/generator-legacy";
import { KeyService } from "@bitwarden/key-management";

import { EmergencyAccessService } from "../../../emergency-access";

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
})
// eslint-disable-next-line rxjs-angular/prefer-takeuntil
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
    stateService: StateService,
    passwordGenerationService: PasswordGenerationServiceAbstraction,
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
      i18nService,
      keyService,
      messagingService,
      passwordGenerationService,
      platformUtilsService,
      policyService,
      stateService,
      dialogService,
      kdfConfigService,
      masterPasswordService,
      accountService,
      toastService,
    );
  }

  async ngOnInit() {
    const policies = await this.emergencyAccessService.getGrantorPolicies(
      this.params.emergencyAccessId,
    );
    this.policyService
      .masterPasswordPolicyOptions$(policies)
      .pipe(takeUntil(this.destroy$))
      .subscribe((enforcedPolicyOptions) => (this.enforcedPolicyOptions = enforcedPolicyOptions));
  }

  // eslint-disable-next-line rxjs-angular/prefer-takeuntil
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
