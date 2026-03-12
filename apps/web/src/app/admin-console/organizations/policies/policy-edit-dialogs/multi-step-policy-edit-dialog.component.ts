import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Inject,
  Signal,
  ViewContainerRef,
  WritableSignal,
  computed,
  signal,
  viewChild,
} from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { FormBuilder } from "@angular/forms";
import { map, of, startWith, switchMap } from "rxjs";

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

  private readonly currentStepConfig = computed(() => this.policySteps()[this.currentStep()]);

  protected readonly saveDisabled = toSignal(
    toObservable(this.currentStepConfig).pipe(
      switchMap((stepConfig) => {
        if (stepConfig?.disableSave) {
          return stepConfig.disableSave;
        }
        if (this.policyComponent?.data) {
          return this.policyComponent.data.statusChanges.pipe(
            startWith(this.policyComponent.data.status),
            map((status) => status !== "VALID"),
          );
        }
        return of(false);
      }),
    ),
    { initialValue: false },
  );

  constructor(
    @Inject(DIALOG_DATA) data: PolicyEditDialogData,
    accountService: AccountService,
    policyApiService: PolicyApiServiceAbstraction,
    i18nService: I18nService,
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
    // Setting policySteps triggers currentStepConfig to recompute, which re-evaluates saveDisabled.
    this.policySteps.set(this.policyComponent.policySteps ?? []);
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
      if (isLastStep || (typeof result === "object" && result.closeDialog)) {
        this.toastService.showToast({
          variant: "success",
          message: this.i18nService.t("editedPolicyId", this.i18nService.t(this.data.policy.name)),
        });
        this.dialogRef.close("saved");
        return;
      }

      // Not the last step - advance to next step
      this.currentStep.update((value) => value + 1);
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
