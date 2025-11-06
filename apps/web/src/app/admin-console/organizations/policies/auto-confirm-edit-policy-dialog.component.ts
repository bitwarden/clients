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
import {
  combineLatest,
  firstValueFrom,
  map,
  Observable,
  of,
  shareReplay,
  startWith,
  switchMap,
  tap,
} from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { PolicyRequest } from "@bitwarden/common/admin-console/models/request/policy.request";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { getById } from "@bitwarden/common/platform/misc";
import {
  DIALOG_DATA,
  DialogConfig,
  DialogRef,
  DialogService,
  ToastService,
} from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

import { SharedModule } from "../../../shared";

import { AutoConfirmPolicyEditComponent } from "./policy-edit-definitions/auto-confirm-policy.component";
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
 * Satisfies the PolicyDialogComponent interface structurally
 * via its static open() function.
 */
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "auto-confirm-edit-policy-dialog.component.html",
  imports: [SharedModule],
})
export class AutoConfirmPolicyDialogComponent
  extends PolicyEditDialogComponent
  implements AfterViewInit
{
  policyType = PolicyType;

  protected readonly firstTimeDialog = signal(false);
  protected readonly currentStep = signal(0);
  protected multiStepSubmit: Observable<MultiStepSubmit[]> = of([]);
  protected autoConfirmEnabled$: Observable<boolean> = this.accountService.activeAccount$.pipe(
    getUserId,
    switchMap((userId) => this.policyService.policies$(userId)),
    map((policies) => policies.find((p) => p.type === PolicyType.AutoConfirm)?.enabled ?? false),
  );
  protected managePolicies$: Observable<boolean> = this.accountService.activeAccount$.pipe(
    getUserId,
    switchMap((userId) => this.organizationService.organizations$(userId)),
    getById(this.data.organizationId),
    map((organization) => (!organization?.isAdmin && organization?.canManagePolicies) ?? false),
  );

  private readonly submitPolicy: Signal<TemplateRef<unknown> | undefined> = viewChild("step0");
  private readonly openExtension: Signal<TemplateRef<unknown> | undefined> = viewChild("step1");

  private readonly submitPolicyTitle: Signal<TemplateRef<unknown> | undefined> =
    viewChild("step0Title");
  private readonly openExtensionTitle: Signal<TemplateRef<unknown> | undefined> =
    viewChild("step1Title");

  override policyComponent: AutoConfirmPolicyEditComponent | undefined;

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
    private organizationService: OrganizationService,
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

    if (this.policyComponent) {
      this.saveDisabled$ = combineLatest([
        this.autoConfirmEnabled$,
        this.policyComponent.enabled.valueChanges.pipe(
          startWith(this.policyComponent.enabled.value),
        ),
      ]).pipe(map(([policyEnabled, value]) => !policyEnabled && !value));
    }

    this.multiStepSubmit = this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => this.policyService.policies$(userId)),
      map((policies) => policies.find((p) => p.type === PolicyType.SingleOrg)?.enabled ?? false),
      tap((singleOrgPolicyEnabled) =>
        this.policyComponent?.setSingleOrgEnabled(singleOrgPolicyEnabled),
      ),
      switchMap((singleOrgPolicyEnabled) => this.buildMultiStepSubmit(singleOrgPolicyEnabled)),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  private buildMultiStepSubmit(singleOrgPolicyEnabled: boolean): Observable<MultiStepSubmit[]> {
    return this.managePolicies$.pipe(
      map((managePoliciesOnly) => {
        const submitSteps = [
          {
            sideEffect: () => this.handleSubmit(singleOrgPolicyEnabled ?? false),
            footerContent: this.submitPolicy,
            titleContent: this.submitPolicyTitle,
          },
        ];

        if (!managePoliciesOnly) {
          submitSteps.push({
            sideEffect: () => this.openBrowserExtension(),
            footerContent: this.openExtension,
            titleContent: this.openExtensionTitle,
          });
        }
        return submitSteps;
      }),
    );
  }

  private async handleSubmit(singleOrgEnabled: boolean) {
    if (!singleOrgEnabled) {
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

      this.currentStep.update((value) => value + 1);
      this.policyComponent.setStep(this.currentStep());
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
