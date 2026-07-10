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
import { ActivatedRoute, Router } from "@angular/router";

import {
  PamApiService,
  TargetSystemKind,
  TargetSystemMethod,
  TargetSystemResponse,
  TargetSystemCreateRequest,
  TargetSystemNameRequest,
  TargetSystemPolicyRequest,
  PasswordPolicy,
} from "@bitwarden/bit-pam";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
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
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

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
    { validators: [minMaxValidator] },
  );
}

/**
 * Routed create/edit page for a PAM target system.
 *
 * Create mode: full form — name, method (radio Automatic/Manual), and (when Automatic)
 * kind select, password policy, session-termination checkbox.
 *
 * Edit mode (targetSystemId param present): method/kind are display-only (immutable once
 * created). Two independent save actions:
 *  - Name card → PUT name
 *  - Policy card (Automatic only) → PUT policy (with withdrawal warning for
 *    supportsSessionTermination when unchecking)
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
    TypographyModule,
    I18nPipe,
  ],
})
export class TargetSystemEditComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);
  private readonly pamApi = inject(PamApiService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);

  private readonly organizationId = this.route.snapshot.params.organizationId as OrganizationId;
  private readonly targetSystemId = this.route.snapshot.params.targetSystemId as string | undefined;

  protected readonly editing = this.targetSystemId != null;
  protected readonly loading = signal(true);
  protected readonly existing = signal<TargetSystemResponse | null>(null);

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

  /**
   * Whether the Integration + password-policy cards should be shown — i.e. the method is
   * Automatic (create: the live radio selection; edit: the existing system's method).
   */
  protected readonly showPolicyCard = computed(() => {
    if (this.editing) {
      return this.existing()?.method === TargetSystemMethod.Automatic;
    }
    return this.createMethod() === TargetSystemMethod.Automatic;
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
      const response = await this.pamApi.listTargetSystems(this.organizationId);
      const system = response.data.find((s) => s.id === this.targetSystemId);
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

  private applySystem(system: TargetSystemResponse): void {
    this.nameForm.patchValue({ name: system.name });
    if (system.method === TargetSystemMethod.Automatic && system.passwordPolicy != null) {
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

  /** Create mode: single submit creates the target system. */
  protected readonly submitCreate = async (): Promise<void> => {
    this.createForm.markAllAsTouched();
    this.policyForm.markAllAsTouched();
    const method = this.createForm.controls.method.value;

    if (this.createForm.invalid) {
      return;
    }
    if (method === TargetSystemMethod.Automatic && this.policyForm.invalid) {
      return;
    }

    const { name } = this.createForm.getRawValue();

    try {
      if (method === TargetSystemMethod.Automatic) {
        const policy = this.policyForm.getRawValue();
        const passwordPolicy: PasswordPolicy = {
          minLength: policy.minLength,
          maxLength: policy.maxLength,
          includeUppercase: policy.includeUppercase,
          includeLowercase: policy.includeLowercase,
          includeDigits: policy.includeDigits,
          includeSymbols: policy.includeSymbols,
        };
        const kind = this.createForm.controls.kind.value;
        await this.pamApi.createTargetSystem(
          this.organizationId,
          new TargetSystemCreateRequest({
            name,
            method: TargetSystemMethod.Automatic,
            kind,
            passwordPolicy,
            supportsSessionTermination: policy.supportsSessionTermination,
          }),
        );
      } else {
        await this.pamApi.createTargetSystem(
          this.organizationId,
          new TargetSystemCreateRequest({
            name,
            method: TargetSystemMethod.Manual,
          }),
        );
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

  /** Edit mode: save just the name. */
  protected readonly submitName = async (): Promise<void> => {
    this.nameForm.markAllAsTouched();
    if (this.nameForm.invalid) {
      return;
    }
    const { name } = this.nameForm.getRawValue();
    try {
      const updated = await this.pamApi.renameTargetSystem(
        this.organizationId,
        this.targetSystemId!,
        new TargetSystemNameRequest({ name }),
      );
      this.existing.set(updated);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamTargetSystemNameSaved"),
      });
    } catch (e) {
      this.showError(e);
    }
  };

  /** Edit mode: save the password policy (Automatic only). */
  protected readonly submitPolicy = async (): Promise<void> => {
    this.policyForm.markAllAsTouched();
    if (this.policyForm.invalid) {
      return;
    }
    const policy = this.policyForm.getRawValue();
    const passwordPolicy: PasswordPolicy = {
      minLength: policy.minLength,
      maxLength: policy.maxLength,
      includeUppercase: policy.includeUppercase,
      includeLowercase: policy.includeLowercase,
      includeDigits: policy.includeDigits,
      includeSymbols: policy.includeSymbols,
    };
    try {
      const updated = await this.pamApi.updateTargetSystemPolicy(
        this.organizationId,
        this.targetSystemId!,
        new TargetSystemPolicyRequest({
          passwordPolicy,
          supportsSessionTermination: policy.supportsSessionTermination,
        }),
      );
      this.existing.set(updated);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamTargetSystemPolicySaved"),
      });
    } catch (e) {
      this.showError(e);
    }
  };

  protected readonly cancel = (): Promise<boolean> => this.navigateToList();

  private navigateToList(): Promise<boolean> {
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
