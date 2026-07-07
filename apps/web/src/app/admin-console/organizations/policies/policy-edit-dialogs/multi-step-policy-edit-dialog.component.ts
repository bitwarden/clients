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
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
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

  /**
   * True when this dialog is showing the v2/drawer experience for this policy (badge header,
   * v2 component, no "Edit policy" label). This is only the case when the policy defines a `v2`
   * component AND the dialog was actually opened as a drawer - i.e. the `PolicyDrawers` flag is
   * on. `dialogRef.isDrawer` is only true when {@link PoliciesComponent.edit} called
   * `openDrawer()`, which only happens when that flag is enabled, so this keeps the v2 look from
   * leaking into the plain modal dialog used when the flag is off.
   */
  protected readonly isV2 = computed(() => !!this.dialogRef.isDrawer && !!this.policy.v2);

  protected readonly dialogTitle = computed(() => {
    if (this.currentStepConfig()?.titleContent?.()) {
      return undefined;
    }
    return this.isV2() ? this.i18nService.t(this.policy.name) : this.i18nService.t("editPolicy");
  });

  protected readonly dialogSubtitle = computed(() => {
    if (this.currentStepConfig()?.titleContent?.() || this.isV2()) {
      return undefined;
    }
    return this.i18nService.t(this.policy.name);
  });

  /**
   * Whether to render `policy.description` in the dialog body. Only consults `policy.v2`'s
   * override when {@link isV2} is true - v1 always uses the plain top-level fields so a
   * `v2`-only override (e.g. because the v2 component renders its own description) can't hide
   * the description from the v1 modal.
   */
  protected readonly showDescription = computed(() =>
    this.isV2()
      ? (this.policy.v2?.showDescription ?? this.policy.showDescription)
      : this.policy.showDescription,
  );

  protected readonly descriptionKey = computed(() =>
    this.isV2()
      ? (this.policy.v2?.description ?? this.policy.description)
      : this.policy.description,
  );

  protected readonly saveDisabled = toSignal(
    toObservable(this.currentStepConfig).pipe(
      switchMap((stepConfig) => {
        if (stepConfig?.disableSave) {
          return stepConfig.disableSave;
        }
        const policyComponent = this.policyComponent();
        if (policyComponent?.data) {
          return policyComponent.data.statusChanges.pipe(
            startWith(policyComponent.data.status),
            map((status) => status === "INVALID"),
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
    dialogService: DialogService,
    configService: ConfigService,
    authService: AuthService,
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
      dialogService,
      configService,
      authService,
    );
  }

  override async ngAfterViewInit() {
    const policyResponse = await this.load();
    this.policyEnabled.set(policyResponse.enabled);
    this.loading.set(false);

    const policyFormRef = this.policyFormViewRef();
    if (!policyFormRef) {
      throw new Error("Template not initialized.");
    }

    // Load the v2 component only when this dialog is actually rendering the v2/drawer
    // experience (see isV2 above) - otherwise fall back to the standard component so the flag-off
    // modal keeps looking like the original dialog.
    const componentRef = policyFormRef.createComponent(
      this.isV2() ? this.data.policy.v2!.component : this.data.policy.component,
    );
    componentRef.setInput("policyResponse", policyResponse);
    componentRef.setInput("policy", this.data.policy);
    componentRef.setInput("currentStep", this.currentStep);
    componentRef.setInput("organizationId", this.data.organization.id);
    const component = componentRef.instance;
    this.policyComponent.set(component);

    // Read step configuration from child component.
    // Setting policySteps triggers currentStepConfig to recompute, which re-evaluates saveDisabled.
    this.policySteps.set(component.policySteps ?? []);

    await this.setupDiscardGuard();
  }

  override readonly submit = async () => {
    if (!this.policyComponent()) {
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
        await this.dialogRef.close("saved");
        return;
      }

      // Not the last step - advance to next step. Reset dirty state so that
      // the discard-edits guard treats the saved values as the new baseline.
      this.currentStep.update((value) => value + 1);
      const component = this.policyComponent();
      if (component) {
        component.enabled.markAsPristine();
        component.data?.markAsPristine();
      }
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

  static readonly openDrawer = (
    dialogService: DialogService,
    config: DialogConfig<PolicyEditDialogData>,
  ) => {
    return dialogService.openDrawer<PolicyEditDialogResult, PolicyEditDialogData>(
      MultiStepPolicyEditDialogComponent,
      config,
    );
  };
}
