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
import { takeUntilDestroyed, toObservable, toSignal } from "@angular/core/rxjs-interop";
import { FormBuilder } from "@angular/forms";
import { filter, map, of, startWith, switchMap } from "rxjs";

import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
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

  protected readonly dialogTitle = computed(() => {
    if (this.currentStepConfig()?.titleContent?.()) {
      return undefined;
    }
    return this.policy.showEnabledBadge
      ? this.i18nService.t(this.policy.name)
      : this.i18nService.t("editPolicy");
  });

  protected readonly dialogSubtitle = computed(() => {
    if (this.currentStepConfig()?.titleContent?.() || this.policy.showEnabledBadge) {
      return undefined;
    }
    return this.i18nService.t(this.policy.name);
  });

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
    );
  }

  protected override readonly discardDialogOptions = {
    title: { key: "discardEditsTitle" },
    content: { key: "discardEditsConfirmation" },
    type: "danger" as const,
    hideIcon: true,
    acceptButtonText: { key: "discardEdits" },
    cancelButtonText: { key: "backToEditing" },
  };

  protected override async setupDiscardGuard(): Promise<void> {
    this.discardGuardEnabled.set(true);
    this.dialogRef.closePredicate = async (result?: PolicyEditDialogResult) => {
      if (result || !this.isFormDirty()) {
        return true;
      }
      const confirmed = await this.dialogService.openSimpleDialog(this.discardDialogOptions);
      if (confirmed) {
        this.discardGuardEnabled.set(false);
      }
      return confirmed;
    };

    this.accountService.activeAccount$
      .pipe(
        switchMap((account) => {
          if (account?.id == null) {
            return of(null);
          }
          return this.authService
            .authStatusFor$(account.id)
            .pipe(filter((status) => status !== AuthenticationStatus.Unlocked));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.discardGuardEnabled.set(false);
        this.dialogRef.closePredicate = undefined;
      });
  }

  protected override readonly cancel = async () => {
    if (!this.discardGuardEnabled() || !this.isFormDirty()) {
      await this.dialogRef.close();
      return;
    }
    const confirmed = await this.dialogService.openSimpleDialog(this.discardDialogOptions);
    if (confirmed) {
      this.dialogRef.closePredicate = undefined;
      await this.dialogRef.close();
    }
  };

  override async ngAfterViewInit() {
    const policyResponse = await this.load();
    this.policyEnabled.set(policyResponse.enabled);
    this.loading.set(false);

    const policyFormRef = this.policyFormViewRef();
    if (!policyFormRef) {
      throw new Error("Template not initialized.");
    }

    // Create the policy component instance
    const componentRef = policyFormRef.createComponent(this.data.policy.component);
    componentRef.setInput("policyResponse", policyResponse);
    componentRef.setInput("policy", this.data.policy);
    componentRef.setInput("currentStep", this.currentStep);
    componentRef.setInput("organizationId", this.data.organization.id);
    const component = componentRef.instance;
    this.policyComponent.set(component);

    // Read step configuration from child component.
    // Setting policySteps triggers currentStepConfig to recompute, which re-evaluates saveDisabled.
    this.policySteps.set(component.policySteps ?? []);

    if (this.dialogRef.isDrawer) {
      await this.setupDiscardGuard();
    }
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
