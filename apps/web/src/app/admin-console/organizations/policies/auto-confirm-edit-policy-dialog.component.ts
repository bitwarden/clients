import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  Inject,
  signal,
  Signal,
  TemplateRef,
  viewChild,
} from "@angular/core";
import { FormBuilder } from "@angular/forms";
import { Router } from "@angular/router";
import { firstValueFrom, map, Observable, of, switchMap } from "rxjs";

import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { PolicyRequest } from "@bitwarden/common/admin-console/models/request/policy.request";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  DIALOG_DATA,
  DialogConfig,
  DialogRef,
  DialogService,
  ToastService,
} from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

import { SharedModule } from "../../../shared";

import {
  PolicyEditDialogComponent,
  PolicyEditDialogData,
  PolicyEditDialogResult,
} from "./policy-edit-dialog.component";

export type MultiStepSubmit = {
  sideEffect: () => Promise<void>;
  footerContent: Signal<TemplateRef<unknown> | undefined>;
  titleContent: Signal<TemplateRef<unknown> | undefined>;
};

export type AutoConfirmPolicyDialogData = PolicyEditDialogData & {
  firstTimeDialog?: boolean;
};

/**
 * Custom policy dialog component for Auto-Confirm policy.
 * Satisfies the PolicyDialogComponent interface structually
 * via its static open() function.
 */
@Component({
  templateUrl: "auto-confirm-edit-policy-dialog.component.html",
  imports: [SharedModule],
})
export class AutoConfirmPolicyDialogComponent
  extends PolicyEditDialogComponent
  implements AfterViewInit
{
  policyType = PolicyType;

  protected firstTimeDialog = signal(false);
  protected currentStep = signal(0);
  protected multiStepSubmit: Observable<MultiStepSubmit[]> = of([]);

  private submitPolicy: Signal<TemplateRef<unknown> | undefined> = viewChild("step0");
  private openExtension: Signal<TemplateRef<unknown> | undefined> = viewChild("step1");

  private submitPolicyTitle: Signal<TemplateRef<unknown> | undefined> = viewChild("step0Title");
  private openExtensionTitle: Signal<TemplateRef<unknown> | undefined> = viewChild("step1Title");

  constructor(
    @Inject(DIALOG_DATA) protected data: AutoConfirmPolicyDialogData,
    accountService: AccountService,
    policyApiService: PolicyApiServiceAbstraction,
    i18nService: I18nService,
    cdr: ChangeDetectorRef,
    formBuilder: FormBuilder,
    dialogRef: DialogRef<PolicyEditDialogResult>,
    toastService: ToastService,
    configService: ConfigService,
    keyService: KeyService,
    private policyService: PolicyService,
    private router: Router,
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
      configService,
      keyService,
    );

    this.firstTimeDialog.set(data.firstTimeDialog ?? false);
  }

  /**
   * Instantiates the child policy component and inserts it into the view.
   */
  async ngAfterViewInit() {
    await super.ngAfterViewInit();

    this.multiStepSubmit = this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => this.policyService.policies$(userId)),
      map((policies) => policies.find((p) => p.type === PolicyType.SingleOrg && p.enabled)),
      map((singleOrgPolicy) => [
        {
          sideEffect: () => this.handleSubmit(singleOrgPolicy?.enabled ?? false),
          footerContent: this.submitPolicy,
          titleContent: this.submitPolicyTitle,
        },
        {
          sideEffect: () => this.openBrowserExtension(),
          footerContent: this.openExtension,
          titleContent: this.openExtensionTitle,
        },
      ]),
    );
  }

  private async handleSubmit(enabled: boolean) {
    if (!enabled) {
      await this.submitSingleOrg();
    }
    await this.submitAutoConfirm();
  }

  /**
   *  Triggers policy submission for auto confirm.
   *  @returns boolean: true if multi-submit workflow should continue, false otherwise.
   */
  private async submitAutoConfirm() {
    if (!this.policyComponent) {
      throw new Error("PolicyComponent not initialized.");
    }

    const autoConfirmRequest = await this.policyComponent.buildRequest();
    await this.policyApiService.putPolicy(
      this.data.organizationId,
      this.data.policy.type,
      autoConfirmRequest,
    );

    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("editedPolicyId", this.i18nService.t(this.data.policy.name)),
    });

    if (!this.policyComponent.enabled.value) {
      this.dialogRef.close("saved");
    }
  }

  private async submitSingleOrg(): Promise<void> {
    const singleOrgRequest: PolicyRequest = {
      type: PolicyType.SingleOrg,
      enabled: true,
      data: null,
    };

    await this.policyApiService.putPolicy(
      this.data.organizationId,
      PolicyType.SingleOrg,
      singleOrgRequest,
    );
  }

  private async openBrowserExtension() {
    await this.router.navigate(["/browser-extension-prompt"], {
      queryParams: { url: "AutoConfirm" },
    });
  }

  submit = async () => {
    if (!this.policyComponent) {
      throw new Error("PolicyComponent not initialized.");
    }

    if ((await this.policyComponent.confirm()) == false) {
      this.dialogRef.close();
      return;
    }

    try {
      const multiStepSubmit = await firstValueFrom(this.multiStepSubmit);
      await multiStepSubmit[this.currentStep()].sideEffect();

      if (this.currentStep() === multiStepSubmit.length - 1) {
        this.dialogRef.close("saved");
        return;
      }

      this.currentStep.update((step) => step++);
    } catch (error: any) {
      this.toastService.showToast({
        variant: "error",
        message: error.message,
      });
    }
  };

  static open = (
    dialogService: DialogService,
    config: DialogConfig<AutoConfirmPolicyDialogData>,
  ) => {
    return dialogService.open<PolicyEditDialogResult>(AutoConfirmPolicyDialogComponent, config);
  };
}
