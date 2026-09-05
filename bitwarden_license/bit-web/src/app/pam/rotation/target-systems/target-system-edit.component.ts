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

import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { asUuid } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
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
  SELECTABLE_TARGET_SYSTEM_KINDS,
  TargetSystemId,
  TargetSystemKind,
  TargetSystemKindLabel,
  TargetSystemMethod,
  TargetSystemStatus,
  TargetSystem,
} from "../rotation";
import { RotationSdkService } from "../rotation-sdk.service";

const NAME_MAX_LENGTH = 200;
const DEFAULT_MIN_LENGTH = 14;
const DEFAULT_MAX_LENGTH = 64;

/**
 * Whether an integration can end sessions that are already open, and who decides.
 *
 * - `always` — the integration ends them itself; the form states the fact rather than asking.
 * - `never` — it cannot, whatever the operator would like; the form says so and claims nothing.
 *   It declines the capability rather than withdrawing one — see {@link sessionTerminationForUpdate}.
 * - `operatorDeclared` — only the operator's own implementation knows, so the form asks.
 */
type SessionTerminationCapability = "always" | "never" | "operatorDeclared";

/**
 * What each integration can do about sessions that are already open.
 *
 * This is a per-kind fact, not "native versus custom script": rotating an Active Directory account
 * password blocks new sign-ins, but a Kerberos ticket already issued stays valid until it expires,
 * so an LDAP write cannot revoke live sessions the way the Entra and MSSQL APIs do. Declaring it
 * per kind over a `Record<TargetSystemKind, …>` also means a kind the SDK gains cannot reach this
 * form until someone states what it can do.
 *
 * `Unknown` is `never` deliberately: a kind this SDK version cannot model must not claim a
 * capability the operator would then rely on.
 */
const SESSION_TERMINATION_CAPABILITY = Object.freeze({
  entra: "always",
  mssql: "always",
  custom_script: "operatorDeclared",
  active_directory: "never",
  unknown: "never",
} as const satisfies Record<TargetSystemKind, SessionTerminationCapability>);

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

  /**
   * An Angular template can only resolve names against the component instance, so a module-level
   * const has to be held as a field before the template can reference it.
   */
  protected readonly TargetSystemMethod = TargetSystemMethod;

  /** Kind options for the bit-select in Automatic mode. */
  protected readonly kindOptions = SELECTABLE_TARGET_SYSTEM_KINDS.map((value) => ({
    value,
    label: TargetSystemKindLabel[value],
  }));

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

  /** The i18n id naming the loaded system's integration, or `null` when it has none. */
  protected readonly existingKindLabel = computed(() => {
    const kind = this.existing()?.kind;
    return kind == null ? null : TargetSystemKindLabel[kind];
  });

  /**
   * What the integration in play can do about sessions that are already open. `null` while the
   * method is Manual, which has no integration and no daemon session to end.
   */
  private readonly sessionTermination = computed<SessionTerminationCapability | null>(() => {
    const kind = this.selectedKind();
    return kind == null ? null : SESSION_TERMINATION_CAPABILITY[kind];
  });

  protected readonly sessionTerminationAlways = computed(
    () => this.sessionTermination() === "always",
  );

  protected readonly sessionTerminationNever = computed(
    () => this.sessionTermination() === "never",
  );

  /**
   * A loaded system whose kind declares no session termination, which the server nonetheless
   * records as supporting it — a capability written before this kind was named, or by a newer
   * server this SDK version cannot model.
   *
   * The card's "Not supported" line then disagrees with the stored fact, and the fact is the one
   * rotation configs still gate their terminateSessions control on, so the page says which of the
   * two a save keeps.
   */
  protected readonly showRetainedTermination = computed(
    () =>
      this.editing &&
      this.sessionTerminationNever() &&
      this.existing()?.supportsSessionTermination === true,
  );

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
      const system = systems.find((s) => s.id === this.targetSystemId);
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
   * Effective session-termination support for an Automatic system. Only `operatorDeclared` reads
   * the checkbox, so a kind that cannot end sessions submits `false` even when the control still
   * holds a `true` left over from a kind that could.
   */
  private resolvedSessionTermination(): boolean {
    const capability = this.sessionTermination();
    if (capability === "operatorDeclared") {
      return this.policyForm.controls.supportsSessionTermination.value;
    }
    return capability === "always";
  }

  /**
   * What a save writes for `supportsSessionTermination` on a system that already exists.
   *
   * Declining to claim a capability and withdrawing one already granted are different writes, and
   * only the first is this form's to make. A `never` kind states that it cannot end sessions; it
   * says nothing about what the server was told before it, and the update request has no "leave
   * this alone" — the field is required — so the only way to leave the stored fact standing is to
   * send it back. Without that, renaming a system of an unmodelled kind strips a capability that
   * rotation configs gate on, through a card that shows no control to put it back with.
   *
   * Withdrawal stays available where the form does ask: unchecking the `operatorDeclared` box.
   */
  private sessionTerminationForUpdate(): boolean {
    if (!this.isAutomatic()) {
      return false;
    }
    if (this.sessionTermination() === "never") {
      return this.existing()?.supportsSessionTermination ?? false;
    }
    return this.resolvedSessionTermination();
  }

  /** Create mode: single submit creates the target system. */
  protected readonly submitCreate = async (): Promise<void> => {
    this.createForm.markAllAsTouched();
    this.policyForm.markAllAsTouched();
    const method = this.createForm.controls.method.value;

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

    if (this.nameForm.invalid || this.policyForm.invalid) {
      return;
    }

    const { name } = this.nameForm.getRawValue();
    try {
      await this.rotationSdk.updateTargetSystem(this.organizationId, this.targetSystemId!, {
        name,
        passwordPolicy: this.buildPasswordPolicy(),
        supportsSessionTermination: this.sessionTerminationForUpdate(),
      });

      // The write answers with no content, so re-read rather than assume the request body is now
      // the stored state.
      await this.loadSystem();
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
