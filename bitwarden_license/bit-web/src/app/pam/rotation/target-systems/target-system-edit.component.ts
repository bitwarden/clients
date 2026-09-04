import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import {
  AbstractControl,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from "@angular/forms";
import { ActivatedRoute, CanDeactivateFn, Router } from "@angular/router";

import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { asUuid, uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  AsyncActionsModule,
  BreadcrumbsModule,
  ButtonModule,
  CalloutModule,
  CardComponent,
  CheckboxModule,
  DialogService,
  FormFieldModule,
  HeaderComponent,
  IconModule,
  RadioButtonModule,
  SectionComponent,
  SectionHeaderComponent,
  SelectModule,
  SpinnerComponent,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import {
  PasswordPolicy,
  TargetSystemId,
  TargetSystemKind,
  TargetSystemMethod,
  TargetSystemStatus,
  TargetSystem,
} from "../rotation";
import { RotationSdkService } from "../rotation-sdk.service";

const NAME_MAX_LENGTH = 200;
const DEFAULT_MIN_LENGTH = 14;
const DEFAULT_MAX_LENGTH = 64;

type PolicyControls = {
  minLength: FormControl<number>;
  maxLength: FormControl<number>;
  includeUppercase: FormControl<boolean>;
  includeLowercase: FormControl<boolean>;
  includeDigits: FormControl<boolean>;
  includeSymbols: FormControl<boolean>;
  supportsSessionTermination: FormControl<boolean>;
};
type PolicyGroup = FormGroup<PolicyControls>;

/** Cross-field validator: minLength must be <= maxLength. */
const minMaxValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const group = control as PolicyGroup;
  const min = group.controls.minLength.value;
  const max = group.controls.maxLength.value;
  return min > max ? { minExceedsMax: true } : null;
};

/** Cross-field validator: at least one character class must be enabled. */
const characterClassValidator: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const group = control as PolicyGroup;
  const anyEnabled =
    group.controls.includeUppercase.value ||
    group.controls.includeLowercase.value ||
    group.controls.includeDigits.value ||
    group.controls.includeSymbols.value;
  return anyEnabled ? null : { noCharacterClass: true };
};

function buildPolicyGroup(fb: FormBuilder): PolicyGroup {
  return new FormGroup<PolicyControls>(
    {
      minLength: fb.nonNullable.control(DEFAULT_MIN_LENGTH, [
        Validators.required,
        Validators.min(1),
        Validators.max(999),
      ]),
      maxLength: fb.nonNullable.control(DEFAULT_MAX_LENGTH, [
        Validators.required,
        Validators.min(1),
        Validators.max(999),
      ]),
      includeUppercase: fb.nonNullable.control(true),
      includeLowercase: fb.nonNullable.control(true),
      includeDigits: fb.nonNullable.control(true),
      includeSymbols: fb.nonNullable.control(true),
      supportsSessionTermination: fb.nonNullable.control(false),
    },
    { validators: [minMaxValidator, characterClassValidator] },
  );
}

/**
 * Routed create/edit page for a PAM target system.
 *
 * Create mode: full form — name, method (radio Automatic/Manual), and (when Automatic)
 * kind select, password policy, session-termination checkbox.
 *
 * Edit mode (targetSystemId param present): method/kind are display-only (immutable once
 * created). A single Save action persists the name and — for Automatic systems — the
 * password policy together (with a withdrawal warning for supportsSessionTermination when
 * unchecking). The footer also carries the retirement action: Disable when the system is in
 * service, Enable when it is not. There is no delete — see {@link disableSystem}.
 */
@Component({
  templateUrl: "./target-system-edit.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    AsyncActionsModule,
    BreadcrumbsModule,
    ButtonModule,
    CalloutModule,
    CardComponent,
    CheckboxModule,
    FormFieldModule,
    HeaderComponent,
    IconModule,
    RadioButtonModule,
    SectionComponent,
    SectionHeaderComponent,
    SelectModule,
    SpinnerComponent,
    TypographyModule,
    I18nPipe,
  ],
})
export class TargetSystemEditComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);
  private readonly rotationSdk = inject(RotationSdkService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);

  private readonly organizationId = this.route.snapshot.params.organizationId as OrganizationId;
  private readonly targetSystemId: TargetSystemId | undefined =
    this.route.snapshot.params.targetSystemId == null
      ? undefined
      : asUuid<TargetSystemId>(this.route.snapshot.params.targetSystemId);

  protected readonly editing = this.targetSystemId != null;
  protected readonly loading = signal(true);
  protected readonly existing = signal<TargetSystem | null>(null);

  protected readonly titleText = computed(() =>
    this.i18nService.t(this.editing ? "pamTargetSystemEditTitle" : "pamTargetSystemCreateTitle"),
  );

  /** Expose const objects for template comparisons. */
  protected readonly TargetSystemMethod = TargetSystemMethod;
  protected readonly TargetSystemKind = TargetSystemKind;

  /** Kind options for the bit-select in Automatic mode. */
  protected readonly kindOptions = [
    { value: TargetSystemKind.Entra, label: "pamTargetSystemKindEntra" },
    { value: TargetSystemKind.Mssql, label: "pamTargetSystemKindMssql" },
    { value: TargetSystemKind.CustomScript, label: "pamTargetSystemKindCustomScript" },
  ] as const;

  // -----------------------------------------------------------------------
  // Create-mode form (single submit for everything)
  // -----------------------------------------------------------------------

  protected readonly createForm = this.formBuilder.nonNullable.group({
    name: ["", [Validators.required, Validators.maxLength(NAME_MAX_LENGTH)]],
    method: [TargetSystemMethod.Automatic as TargetSystemMethod, [Validators.required]],
    kind: [TargetSystemKind.Entra as TargetSystemKind, [Validators.required]],
  });

  /** Automatic-only policy sub-form (separate group so it can be conditionally validated). */
  protected readonly policyForm = buildPolicyGroup(this.formBuilder);

  /** Live create-mode method selection — drives the Integration/policy cards reactively. */
  private readonly createMethod = toSignal(this.createForm.controls.method.valueChanges, {
    initialValue: this.createForm.controls.method.value,
  });

  /** Live create-mode kind selection — drives the session-termination presentation reactively. */
  private readonly createKind = toSignal(this.createForm.controls.kind.valueChanges, {
    initialValue: this.createForm.controls.kind.value,
  });

  /** The method in play — the existing system's method (edit) or the live radio selection (create). */
  private readonly method = computed<TargetSystemMethod | null>(() => {
    if (this.editing) {
      return this.existing()?.method ?? null;
    }
    return this.createMethod();
  });

  /**
   * The method in play is Automatic. Gates the integration (kind) card and the session-termination
   * control — both are Automatic-only (Manual systems have no integration and no daemon session).
   */
  protected readonly isAutomatic = computed(() => this.method() === TargetSystemMethod.Automatic);

  /** The method in play is Manual — gates the "rotate by hand" password-rules hint. */
  protected readonly isManual = computed(() => this.method() === TargetSystemMethod.Manual);

  /**
   * The password-policy card is shown for both methods: Automatic (the daemon enforces the rules)
   * and Manual (the rules the operator follows when rotating the credential by hand).
   */
  protected readonly showPolicyCard = computed(() => this.isAutomatic() || this.isManual());

  /** The integration kind in play — the existing system's kind (edit) or the live selection (create Automatic). */
  private readonly selectedKind = computed<TargetSystemKind | null>(() =>
    this.isAutomatic()
      ? this.editing
        ? (this.existing()?.kind ?? null)
        : this.createKind()
      : null,
  );

  /**
   * Native integrations (Entra, Mssql — anything other than a custom script) always terminate
   * active sessions after rotation; the capability is intrinsic, so the form shows a static
   * "Supported" indicator rather than an editable checkbox.
   */
  protected readonly isNativeIntegration = computed(() => {
    const kind = this.selectedKind();
    return kind != null && kind !== TargetSystemKind.CustomScript;
  });

  /**
   * Whether to show the session-termination withdrawal warning (only in edit mode,
   * only when the existing system had supportsSessionTermination=true and the user
   * unchecks it).
   */
  protected readonly showTerminationWarning = computed(() => {
    if (!this.editing) {
      return false;
    }
    const existing = this.existing();
    if (existing?.supportsSessionTermination !== true) {
      return false;
    }
    return !this.policyForm.controls.supportsSessionTermination.value;
  });

  // -----------------------------------------------------------------------
  // Edit-mode name form (separate from policy)
  // -----------------------------------------------------------------------

  protected readonly nameForm = this.formBuilder.nonNullable.group({
    name: ["", [Validators.required, Validators.maxLength(NAME_MAX_LENGTH)]],
  });

  constructor() {
    void this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      if (this.editing) {
        await this.loadSystem();
      } else {
        this.applyTemplate(this.route.snapshot.queryParams?.["template"] as string | undefined);
      }
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Seed the create form from a starter template chosen on the empty state
   * (Manual / Entra / Custom script). Unknown/absent values keep the defaults.
   */
  private applyTemplate(template: string | undefined): void {
    switch (template) {
      case "manual":
        this.createForm.patchValue({ method: TargetSystemMethod.Manual });
        break;
      case "entra":
        this.createForm.patchValue({
          method: TargetSystemMethod.Automatic,
          kind: TargetSystemKind.Entra,
        });
        break;
      case "custom-script":
        this.createForm.patchValue({
          method: TargetSystemMethod.Automatic,
          kind: TargetSystemKind.CustomScript,
        });
        break;
    }
  }

  private async loadSystem(): Promise<void> {
    try {
      const systems = await this.rotationSdk.listTargetSystems(this.organizationId);
      const routeId = uuidAsString(this.targetSystemId!).toLowerCase();
      const system = systems.find((s) => uuidAsString(s.id).toLowerCase() === routeId);
      if (system == null) {
        this.toastService.showToast({
          variant: "error",
          message: this.i18nService.t("pamTargetSystemNotFound"),
        });
        await this.navigateToList();
        return;
      }
      this.existing.set(system);
      this.applySystem(system);
    } catch {
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("pamTargetSystemNotFound"),
      });
      await this.navigateToList();
    }
  }

  private applySystem(system: TargetSystem): void {
    this.nameForm.patchValue({ name: system.name });
    // A policy exists for both Automatic and Manual systems; pre-fill it for either.
    if (system.passwordPolicy != null) {
      this.policyForm.patchValue({
        minLength: system.passwordPolicy.minLength,
        maxLength: system.passwordPolicy.maxLength,
        includeUppercase: system.passwordPolicy.includeUppercase,
        includeLowercase: system.passwordPolicy.includeLowercase,
        includeDigits: system.passwordPolicy.includeDigits,
        includeSymbols: system.passwordPolicy.includeSymbols,
        supportsSessionTermination: system.supportsSessionTermination ?? false,
      });
    }
  }

  // -----------------------------------------------------------------------
  // Submit handlers
  // -----------------------------------------------------------------------

  /** Build a PasswordPolicy from the current policy-form values. */
  private buildPasswordPolicy(): PasswordPolicy {
    const policy = this.policyForm.getRawValue();
    return {
      minLength: policy.minLength,
      maxLength: policy.maxLength,
      includeUppercase: policy.includeUppercase,
      includeLowercase: policy.includeLowercase,
      includeDigits: policy.includeDigits,
      includeSymbols: policy.includeSymbols,
    };
  }

  /**
   * Effective session-termination support for an Automatic system: native integrations always
   * support it; custom scripts follow the checkbox. Callers gate this on the method being Automatic.
   */
  private resolvedSessionTermination(): boolean {
    return this.isNativeIntegration() || this.policyForm.controls.supportsSessionTermination.value;
  }

  /** Create mode: single submit creates the target system. */
  protected readonly submitCreate = async (): Promise<void> => {
    this.createForm.markAllAsTouched();
    this.policyForm.markAllAsTouched();
    const method = this.createForm.controls.method.value;

    // The password policy applies to both methods now, so it is always validated.
    if (this.createForm.invalid || this.policyForm.invalid) {
      return;
    }

    const { name } = this.createForm.getRawValue();
    const passwordPolicy = this.buildPasswordPolicy();

    try {
      if (method === TargetSystemMethod.Automatic) {
        await this.rotationSdk.createTargetSystem(this.organizationId, {
          method: "automatic",
          name,
          kind: this.createForm.controls.kind.value,
          passwordPolicy,
          supportsSessionTermination: this.resolvedSessionTermination(),
        });
      } else {
        // A manual target has no integration and no session to terminate, so the union's manual
        // arm carries neither.
        await this.rotationSdk.createTargetSystem(this.organizationId, {
          method: "manual",
          name,
          passwordPolicy,
        });
      }
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamTargetSystemCreated"),
      });
      await this.navigateToList();
    } catch (e) {
      this.showError(e);
    }
  };

  /**
   * Edit mode: single save action. Persists the name and — for Automatic systems —
   * the password policy in one operation, so the page shows a single Save button
   * rather than one per card.
   */
  protected readonly submitEdit = async (): Promise<void> => {
    this.nameForm.markAllAsTouched();
    this.policyForm.markAllAsTouched();

    // Both methods carry a password policy now, so it is always validated + saved.
    if (this.nameForm.invalid || this.policyForm.invalid) {
      return;
    }

    const { name } = this.nameForm.getRawValue();
    try {
      // One write, not two: the server takes the name, the policy and the capability together.
      await this.rotationSdk.updateTargetSystem(this.organizationId, this.targetSystemId!, {
        name,
        passwordPolicy: this.buildPasswordPolicy(),
        // Automatic follows native/custom-script rules; Manual has no daemon session to terminate.
        supportsSessionTermination: this.isAutomatic() && this.resolvedSessionTermination(),
      });

      // The write answers with no content, so re-read rather than assume the request body is now
      // the stored state.
      await this.loadSystem();
      this.nameForm.markAsPristine();
      this.policyForm.markAsPristine();
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamTargetSystemSaved"),
      });
    } catch (e) {
      this.showError(e);
    }
  };

  /**
   * Whether the loaded system is currently in service. Picks which of the paired retirement
   * actions the edit footer offers. Only read from the edit branch, which renders after
   * {@link loadSystem} has resolved, so the unloaded case never reaches the template.
   */
  protected readonly isActive = computed(
    () => this.existing()?.status === TargetSystemStatus.Active,
  );

  /**
   * Take a target system out of service from the edit page.
   *
   * This is how a target system is retired: there is no delete, because rotation configs
   * reference targets and a rotation's history has to stay attributable. Disable is reversible,
   * so the page stays put and re-reads rather than navigating away — the operator can put it
   * straight back with {@link enableSystem}.
   */
  protected readonly disableSystem = async (): Promise<void> => {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "pamTargetSystemDisableTitle" },
      content: { key: "pamTargetSystemDisableContent" },
      acceptButtonText: { key: "pamTargetSystemDisableConfirm" },
      cancelButtonText: { key: "cancel" },
      type: "warning",
    });
    if (!confirmed) {
      return;
    }
    try {
      await this.rotationSdk.disableTargetSystem(this.organizationId, this.targetSystemId!);
      // Disable answers with no content, so re-read rather than patching the status locally.
      await this.loadSystem();
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamTargetSystemDisableSuccess"),
      });
    } catch (e) {
      this.showError(e);
    }
  };

  /** Return a retired target system to service. No confirmation: it is the recoverable direction. */
  protected readonly enableSystem = async (): Promise<void> => {
    try {
      await this.rotationSdk.enableTargetSystem(this.organizationId, this.targetSystemId!);
      await this.loadSystem();
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamTargetSystemEnableSuccess"),
      });
    } catch (e) {
      this.showError(e);
    }
  };

  /**
   * The form groups that hold user input for the current mode. The policy card is rendered through
   * an `*ngTemplateOutlet` with its own `[formGroup]`, so it is a sibling of the mode's group
   * rather than a child — `createForm.dirty` alone does not see a policy edit.
   */
  private liveForms(): AbstractControl[] {
    return this.editing ? [this.nameForm, this.policyForm] : [this.createForm, this.policyForm];
  }

  /**
   * Confirm before unsaved input is thrown away. Called both by Cancel and by the route's
   * CanDeactivate guard, which covers the breadcrumb and browser back/forward. A pristine form
   * has nothing to lose, so it skips the dialog rather than asking about an empty page.
   */
  async confirmDiscard(): Promise<boolean> {
    if (!this.liveForms().some((form) => form.dirty)) {
      return true;
    }

    // Creating: name the thing being abandoned, the target system itself. Editing: the system
    // already exists and only the edits are lost, so the repo's shared wording is the true one.
    const copy = this.editing
      ? {
          title: { key: "discardEditsTitle" },
          content: { key: "discardEditsConfirmation" },
          acceptButtonText: { key: "discardEdits" },
          cancelButtonText: { key: "keepEditing" },
        }
      : {
          title: { key: "pamTargetSystemDiscardTitle" },
          content: { key: "pamAccessRuleDiscardContent" },
          acceptButtonText: { key: "pamAccessRuleDiscardConfirm" },
          cancelButtonText: { key: "cancel" },
        };

    return await this.dialogService.openSimpleDialog({ ...copy, type: "warning" });
  }

  protected readonly cancel = async (): Promise<void> => {
    if (!(await this.confirmDiscard())) {
      return;
    }

    await this.navigateToList();
  };

  private navigateToList(): Promise<boolean> {
    // A create, a confirmed discard, or a not-found bounce is an exit the admin has already agreed
    // to, so the CanDeactivate guard must not ask a second time.
    this.liveForms().forEach((form) => form.markAsPristine());
    return this.router.navigate([".."], { relativeTo: this.route });
  }

  private showError(e: unknown): void {
    const message =
      e instanceof ErrorResponse
        ? (e.message ?? this.i18nService.t("unexpectedError"))
        : this.i18nService.t("unexpectedError");
    this.toastService.showToast({ variant: "error", message });
  }
}

export const targetSystemEditDiscardGuard: CanDeactivateFn<TargetSystemEditComponent> = (
  component,
) => component.confirmDiscard();
