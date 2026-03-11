import { CommonModule } from "@angular/common";
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Inject,
} from "@angular/core";
import { ReactiveFormsModule, FormBuilder } from "@angular/forms";

import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { PolicyRequest } from "@bitwarden/common/admin-console/models/request/policy.request";
import { PolicyResponse } from "@bitwarden/common/admin-console/models/response/policy.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  AsyncActionsModule,
  ButtonModule,
  DIALOG_DATA,
  DialogConfig,
  DialogModule,
  DialogRef,
  DialogService,
  ToastService,
} from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";
import { I18nPipe } from "@bitwarden/ui-common";

import { SendControlsPolicyComponent } from "../policy-edit-definitions/send-controls.component";
import {
  PolicyEditDialogComponent,
  PolicyEditDialogData,
  PolicyEditDialogResult,
} from "../policy-edit-dialog.component";

@Component({
  templateUrl: "send-controls-policy-dialog.component.html",
  imports: [
    AsyncActionsModule,
    ButtonModule,
    CommonModule,
    DialogModule,
    I18nPipe,
    ReactiveFormsModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SendControlsPolicyDialogComponent
  extends PolicyEditDialogComponent
  implements AfterViewInit
{
  override readonly policyComponent: SendControlsPolicyComponent | undefined;

  constructor(
    @Inject(DIALOG_DATA) protected override readonly data: PolicyEditDialogData,
    accountService: AccountService,
    policyApiService: PolicyApiServiceAbstraction,
    i18nService: I18nService,
    cdr: ChangeDetectorRef,
    formBuilder: FormBuilder,
    dialogRef: DialogRef<PolicyEditDialogResult>,
    toastService: ToastService,
    keyService: KeyService,
  ) {
    super(
      data,
      accountService,
      policyApiService,
      i18nService,
      cdr,
      formBuilder,
      dialogRef,
      toastService,
      keyService,
    );
  }

  async ngAfterViewInit() {
    await super.ngAfterViewInit();
  }

  override async load(): Promise<PolicyResponse> {
    let disableSendEnabled = false;
    let sendOptionsEnabled = false;
    let disableHideEmail = false;

    try {
      const disableSend = await this.policyApiService.getPolicy(
        this.data.organizationId,
        PolicyType.DisableSend,
      );
      disableSendEnabled = disableSend.enabled;
    } catch (e: any) {
      if (e.statusCode !== 404) {
        throw e;
      }
    }

    try {
      const sendOptions = await this.policyApiService.getPolicy(
        this.data.organizationId,
        PolicyType.SendOptions,
      );
      sendOptionsEnabled = sendOptions.enabled;
      disableHideEmail = sendOptionsEnabled && (sendOptions.data?.disableHideEmail ?? false);
    } catch (e: any) {
      if (e.statusCode !== 404) {
        throw e;
      }
    }

    return new PolicyResponse({
      Enabled: disableSendEnabled || sendOptionsEnabled,
      Data: {
        disableSend: disableSendEnabled,
        disableHideEmail,
      },
    });
  }

  override readonly submit = async () => {
    if (!this.policyComponent) {
      throw new Error("PolicyComponent not initialized.");
    }

    if ((await this.policyComponent.confirm()) == false) {
      this.dialogRef.close();
      return;
    }

    try {
      const formEnabled = this.policyComponent.enabled.value ?? false;
      const formData = this.policyComponent.data?.getRawValue() ?? {};

      const disableSendRequest: PolicyRequest = {
        enabled: formEnabled && (formData.disableSend ?? false),
        data: null,
      };

      const disableHideEmailValue = formEnabled && (formData.disableHideEmail ?? false);
      const sendOptionsRequest: PolicyRequest = {
        enabled: disableHideEmailValue,
        data: { disableHideEmail: disableHideEmailValue },
      };

      // These two saves are not atomic. Run in parallel so that a failure in either
      // surfaces immediately rather than leaving a partial save silently applied.
      await Promise.all([
        this.policyApiService.putPolicyVNext(this.data.organizationId, PolicyType.DisableSend, {
          policy: disableSendRequest,
        }),
        this.policyApiService.putPolicyVNext(this.data.organizationId, PolicyType.SendOptions, {
          policy: sendOptionsRequest,
        }),
      ]);

      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("editedPolicyId", this.i18nService.t(this.data.policy.name)),
      });
      this.dialogRef.close("saved");
    } catch (error: any) {
      this.toastService.showToast({
        variant: "error",
        message: error.message,
      });
    }
  };

  static readonly open = (
    dialogService: DialogService,
    config: DialogConfig<PolicyEditDialogData>,
  ) => {
    return dialogService.open<PolicyEditDialogResult>(SendControlsPolicyDialogComponent, config);
  };
}
