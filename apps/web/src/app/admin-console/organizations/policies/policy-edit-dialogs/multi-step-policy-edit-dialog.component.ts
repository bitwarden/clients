import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ComponentRef,
  Inject,
  ViewChild,
  ViewContainerRef,
  WritableSignal,
  signal,
} from "@angular/core";
import { FormBuilder } from "@angular/forms";
import { Observable, map, of, startWith } from "rxjs";

import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  DIALOG_DATA,
  DialogConfig,
  DialogRef,
  DialogService,
  ToastService,
} from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

import { SharedModule } from "../../../../shared";
import { BasePolicyEditComponent } from "../base-policy-edit.component";
import {
  PolicyEditDialogComponent,
  PolicyEditDialogData,
  PolicyEditDialogResult,
} from "../policy-edit-dialog.component";

import { PolicyStep } from "./models";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush when parent is migrated
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-multi-step-policy-edit-dialog",
  templateUrl: "multi-step-policy-edit-dialog.component.html",
  imports: [SharedModule],
})
export class MultiStepPolicyEditDialogComponent
  extends PolicyEditDialogComponent
  implements AfterViewInit
{
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ViewChild("policyForm", { read: ViewContainerRef, static: true })
  override policyFormRef: ViewContainerRef | undefined;

  policySteps: PolicyStep[] = [];
  readonly currentStep: WritableSignal<number> = signal(0);
  override saveDisabled$: Observable<boolean> = of(false);

  protected policyComponentRef: ComponentRef<BasePolicyEditComponent> | undefined;

  constructor(
    @Inject(DIALOG_DATA) data: PolicyEditDialogData,
    accountService: AccountService,
    policyApiService: PolicyApiServiceAbstraction,
    i18nService: I18nService,
    private changeDetectorRef: ChangeDetectorRef,
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
      changeDetectorRef,
      formBuilder,
      dialogRef,
      toastService,
      keyService,
    );
  }

  override async ngAfterViewInit() {
    const policyResponse = await this.load();
    this.loading = false;

    if (!this.policyFormRef) {
      throw new Error("Template not initialized.");
    }

    // Create the policy component instance
    this.policyComponentRef = this.policyFormRef.createComponent(this.data.policy.component);
    this.policyComponent = this.policyComponentRef.instance;

    // Set inputs using ComponentRef API
    this.policyComponentRef.setInput("policyResponse", policyResponse);
    this.policyComponentRef.setInput("policy", this.data.policy);
    this.policyComponentRef.setInput("currentStep", this.currentStep);
    this.policyComponentRef.setInput("organizationId", this.data.organizationId);

    // Read step configuration from child component
    this.policySteps = this.policyComponent.policySteps ?? [];

    // Initialize save disabled state
    this.updateSaveDisabled();

    this.changeDetectorRef.detectChanges();
  }

  private updateSaveDisabled() {
    const currentStepConfig = this.policySteps[this.currentStep()];

    if (currentStepConfig?.disableSave) {
      // Use custom disable logic if provided
      this.saveDisabled$ = currentStepConfig.disableSave;
    } else if (this.policyComponent?.data) {
      // Default: disable if form is invalid
      this.saveDisabled$ = this.policyComponent.data.statusChanges.pipe(
        startWith(this.policyComponent.data.status),
        map((status) => status !== "VALID"),
      );
    } else {
      // No validation needed
      this.saveDisabled$ = of(false);
    }
  }

  override submit = async () => {
    if (!this.policyComponent) {
      throw new Error("PolicyComponent not initialized.");
    }

    try {
      // Execute side effect for current step (if defined)
      const sideEffect = this.policySteps[this.currentStep()]?.sideEffect;
      if (sideEffect) {
        await sideEffect();
      }

      // Check if this is the last step
      if (this.currentStep() === this.policySteps.length - 1) {
        // Final step - show success and close
        this.toastService.showToast({
          variant: "success",
          message: this.i18nService.t("editedPolicyId", this.i18nService.t(this.data.policy.name)),
        });
        this.dialogRef.close("saved");
        return;
      }

      // Not the last step - advance to next step
      this.currentStep.update((value) => value + 1);
      this.updateSaveDisabled();
    } catch (error: any) {
      this.toastService.showToast({
        variant: "error",
        message: error.message,
      });
    }
  };

  static override open = (
    dialogService: DialogService,
    config: DialogConfig<PolicyEditDialogData>,
  ) => {
    return dialogService.open<PolicyEditDialogResult, PolicyEditDialogData>(
      MultiStepPolicyEditDialogComponent,
      config,
    );
  };
}
