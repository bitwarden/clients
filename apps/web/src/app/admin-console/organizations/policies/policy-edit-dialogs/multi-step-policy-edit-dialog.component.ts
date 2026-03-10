import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Inject,
  Signal,
  ViewContainerRef,
  WritableSignal,
  signal,
  viewChild,
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
import {
  PolicyEditDialogComponent,
  PolicyEditDialogData,
  PolicyEditDialogResult,
} from "../policy-edit-dialog.component";

import { PolicyStep } from "./models";

@Component({
  selector: "app-multi-step-policy-edit-dialog",
  templateUrl: "multi-step-policy-edit-dialog.component.html",
  imports: [SharedModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MultiStepPolicyEditDialogComponent
  extends PolicyEditDialogComponent
  implements AfterViewInit
{
  private readonly policyFormViewRef: Signal<ViewContainerRef | undefined> = viewChild(
    "policyForm",
    { read: ViewContainerRef },
  );

  protected readonly policySteps: WritableSignal<PolicyStep[]> = signal([]);
  readonly currentStep: WritableSignal<number> = signal(0);

  // eslint-disable-next-line @bitwarden/components/enforce-readonly-angular-properties -- mutable override of base-class field; reassigned by updateSaveDisabled() on each step transition
  override saveDisabled$: Observable<boolean> = of(false);

  constructor(
    @Inject(DIALOG_DATA) data: PolicyEditDialogData,
    accountService: AccountService,
    policyApiService: PolicyApiServiceAbstraction,
    i18nService: I18nService,
    // Not stored — injected only to satisfy the base-class constructor.
    changeDetectorRef: ChangeDetectorRef,
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

    // #policyForm is always rendered (outside any conditional) so policyFormViewRef is
    // resolved by the time ngAfterViewInit fires — no manual detectChanges() needed.
    const policyFormRef = this.policyFormViewRef();
    if (!policyFormRef) {
      throw new Error("Template not initialized.");
    }

    // Create the policy component instance
    const policyComponentRef = policyFormRef.createComponent(this.data.policy.component);
    this.policyComponent = policyComponentRef.instance;

    // Set inputs using ComponentRef API
    policyComponentRef.setInput("policyResponse", policyResponse);
    policyComponentRef.setInput("policy", this.data.policy);
    policyComponentRef.setInput("currentStep", this.currentStep);
    policyComponentRef.setInput("organizationId", this.data.organizationId);

    // Read step configuration from child component.
    // The signal write schedules a re-render, which picks up both the updated policySteps
    // and the loading=false change in the same cycle — no manual detectChanges() needed.
    this.policySteps.set(this.policyComponent.policySteps ?? []);

    // Initialize save disabled state
    this.updateSaveDisabled();
  }

  private updateSaveDisabled() {
    const currentStepConfig = this.policySteps()[this.currentStep()];

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

  override readonly submit = async () => {
    if (!this.policyComponent) {
      throw new Error("PolicyComponent not initialized.");
    }

    try {
      // Execute side effect for current step (if defined)
      const sideEffect = this.policySteps()[this.currentStep()]?.sideEffect;
      const result = sideEffect ? await sideEffect() : undefined;

      // A sideEffect can return { closeDialog: true } to end the workflow early
      // (e.g. when disabling a policy or for users without permission to see later steps).
      const isLastStep = this.currentStep() === this.policySteps().length - 1;
      if (isLastStep || (result != null && result.closeDialog)) {
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

  static override readonly open = (
    dialogService: DialogService,
    config: DialogConfig<PolicyEditDialogData>,
  ) => {
    return dialogService.open<PolicyEditDialogResult, PolicyEditDialogData>(
      MultiStepPolicyEditDialogComponent,
      config,
    );
  };
}
