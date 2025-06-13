import { CommonModule } from "@angular/common";
import { Component, Inject, OnInit, ViewChild } from "@angular/core";
import { BehaviorSubject, combineLatest, firstValueFrom, map } from "rxjs";

import {
  InputPasswordComponent,
  InputPasswordFlow,
  PasswordInputResult,
} from "@bitwarden/auth/angular";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  ButtonModule,
  CalloutModule,
  DIALOG_DATA,
  DialogConfig,
  DialogModule,
  DialogRef,
  DialogService,
  ToastService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { EmergencyAccessService } from "../../../emergency-access";

type EmergencyAccessTakeoverDialogData = {
  grantorName: string;
  grantorEmail: string;
  /** Traces a unique emergency request */
  emergencyAccessId: string;
};

export const EmergencyAccessTakeoverDialogResultType = {
  Done: "done",
} as const;

export type EmergencyAccessTakeoverDialogResultType =
  (typeof EmergencyAccessTakeoverDialogResultType)[keyof typeof EmergencyAccessTakeoverDialogResultType];

/**
 * This component is used by a Grantee to take over emergency access of a Grantor's account
 * by changing the Grantor's master password. It is displayed as a dialog when the Grantee
 * clicks the "Takeover" button while on the `/settings/emergency-access` page (see `EmergencyAccessComponent`).
 *
 * @link https://bitwarden.com/help/emergency-access/
 */
@Component({
  standalone: true,
  selector: "auth-emergency-access-takeover-dialog",
  templateUrl: "./emergency-access-takeover-dialog.component.html",
  imports: [
    ButtonModule,
    CalloutModule,
    CommonModule,
    DialogModule,
    I18nPipe,
    InputPasswordComponent,
  ],
})
export class EmergencyAccessTakeoverDialogComponent implements OnInit {
  @ViewChild(InputPasswordComponent)
  inputPasswordComponent: InputPasswordComponent | undefined = undefined;

  private parentSubmittingBehaviorSubject = new BehaviorSubject(false);
  parentSubmitting$ = this.parentSubmittingBehaviorSubject.asObservable();

  private childSubmittingBehaviorSubject = new BehaviorSubject(false);
  childSubmitting$ = this.childSubmittingBehaviorSubject.asObservable();

  submitting$ = combineLatest([this.parentSubmitting$, this.childSubmitting$]).pipe(
    map(([parentIsSubmitting, childIsSubmitting]) => parentIsSubmitting || childIsSubmitting),
  );

  initializing = true;
  inputPasswordFlow = InputPasswordFlow.ChangePasswordDelegation;
  masterPasswordPolicyOptions?: MasterPasswordPolicyOptions;

  constructor(
    @Inject(DIALOG_DATA) protected dialogData: EmergencyAccessTakeoverDialogData,
    private accountService: AccountService,
    private dialogRef: DialogRef<EmergencyAccessTakeoverDialogResultType>,
    private emergencyAccessService: EmergencyAccessService,
    private i18nService: I18nService,
    private logService: LogService,
    private policyService: PolicyService,
    private toastService: ToastService,
  ) {}

  async ngOnInit() {
    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));

    /**
     * The ONLY time this call will return an array of policies is when the Grantor is the OWNER
     * of an organization. In all other scenarios the server returns null. Even if the Grantor
     * is the member of an org that has enforced MP policies, the server will still return null
     * because in the Emergency Access Takeover process, the Grantor gets removed from the org upon
     * takeover, and therefore the MP policies are irrelevant.
     *
     * The only scenario where a Grantor does NOT get removed from the org is when that Grantor is the
     * OWNER of the org. In that case the server returns Grantor policies and we enforce them on the client.
     */
    const grantorPolicies = await this.emergencyAccessService.getGrantorPolicies(
      this.dialogData.emergencyAccessId,
    );

    /**
     * If `grantorPolicies` is null/undefined, then fallback to an empty array. This ensures that
     * masterPasswordPolicyOptions$() always uses the Grantor's policies, even if there are none (empty array),
     * and never the Grantee's policies. If we were to leave `grantorPolicies` as null/undefined, the
     * masterPasswordPolicyOptions$() method would use the `activeUserId` and get the Grantee's policies instead.
     * But we only care about the Grantor's policies in the takeover process (even if empty).
     *
     * See the masterPasswordPolicyOptions$() implementation for more details.
     */
    this.masterPasswordPolicyOptions = await firstValueFrom(
      this.policyService.masterPasswordPolicyOptions$(activeUserId, grantorPolicies ?? []),
    );

    this.initializing = false;
  }

  protected handlePrimaryButtonClick = async () => {
    if (!this.inputPasswordComponent) {
      throw new Error("InputPasswordComponent is not initialized");
    }

    await this.inputPasswordComponent.submit();
  };

  protected async handlePasswordFormSubmit(passwordInputResult: PasswordInputResult) {
    this.parentSubmittingBehaviorSubject.next(true);

    try {
      await this.emergencyAccessService.takeover(
        this.dialogData.emergencyAccessId,
        passwordInputResult.newPassword,
        this.dialogData.grantorEmail,
      );
    } catch (e) {
      this.logService.error(e);

      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("unexpectedError"),
      });
    } finally {
      this.parentSubmittingBehaviorSubject.next(false);
    }

    this.dialogRef.close(EmergencyAccessTakeoverDialogResultType.Done);
  }

  protected handleIsSubmittingChange(isSubmitting: boolean) {
    this.childSubmittingBehaviorSubject.next(isSubmitting);
  }

  /**
   * Strongly typed helper to open an EmergencyAccessTakeoverDialogComponent
   * @param dialogService Instance of the dialog service that will be used to open the dialog
   * @param dialogConfig Configuration for the dialog
   */
  static open = (
    dialogService: DialogService,
    dialogConfig: DialogConfig<
      EmergencyAccessTakeoverDialogData,
      DialogRef<EmergencyAccessTakeoverDialogResultType, unknown>
    >,
  ) => {
    return dialogService.open<
      EmergencyAccessTakeoverDialogResultType,
      EmergencyAccessTakeoverDialogData
    >(EmergencyAccessTakeoverDialogComponent, dialogConfig);
  };
}
