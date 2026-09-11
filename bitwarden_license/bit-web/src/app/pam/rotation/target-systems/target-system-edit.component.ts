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
  BadgeModule,
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
  SelectItemView,
  SkeletonComponent,
  SkeletonTextComponent,
  TableModule,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { discardConfirmOptions } from "../../helpers/discard-confirm";
import {
  AssignmentPickerColumn,
  AssignmentPickerComponent,
  AssignmentPickerHints,
  AssignmentPickerRow,
} from "../assignment-picker/assignment-picker.component";
import {
  TARGET_SYSTEM_QUERY_PARAM,
  THEN_MANAGED_CREDENTIAL,
  THEN_QUERY_PARAM,
} from "../create-flow";
import {
  accessConnectorConnectionLabelKey,
  accessConnectorStatusLabelKey,
} from "../daemons/access-connector-label";
import { DetailBreadcrumbComponent } from "../detail-breadcrumb.component";
import {
  AccessConnector,
  AccessConnectorId,
  AccessConnectorStatus,
  PasswordPolicy,
  TargetSystemId,
  TargetSystemKind,
  TargetSystemMethod,
  TargetSystemStatus,
  TargetSystem,
} from "../rotation";
import { ROTATION_TABS, rotationLink } from "../rotation-links";
import { RotationLoadErrorComponent } from "../rotation-load-error.component";
import { RotationLoadingAnnouncerComponent } from "../rotation-loading-announcer.component";
import { RotationSdkService } from "../rotation-sdk.service";
import { showSkeletonWhile } from "../skeleton-delay";

import { targetSystemKindLabelKey } from "./target-system-label";

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

/** Cross-field validator: minLength no greater than maxLength. */
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

/**
 * How a row in the assigned-connectors table stands relative to what the server holds: an
 * assignment the operator has added, one they have taken away, or one already stored.
 */
type StagedAssignment = "assign" | "unassign";

const STAGED_LABEL_KEYS: Record<StagedAssignment, string> = {
  assign: "pamRotationAssignmentPendingAssign",
  unassign: "pamRotationAssignmentPendingUnassign",
};

/** One row of the assigned-access-connectors table. */
interface ConnectorAssignmentRow extends AssignmentPickerRow {
  readonly connector: AccessConnector;
  readonly enabled: boolean;
  readonly statusLabelKey: string;
  readonly connectionLabelKey: string;
  readonly staged: StagedAssignment | null;
  /** Says which side of the save the row is on; null once it is what the server holds. */
  readonly stagedLabelKey: string | null;
  readonly removing: boolean;
}

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
 */
@Component({
  templateUrl: "./target-system-edit.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    AsyncActionsModule,
    BadgeModule,
    DetailBreadcrumbComponent,
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
    SkeletonComponent,
    SkeletonTextComponent,
    TableModule,
    TypographyModule,
    AssignmentPickerComponent,
    RotationLoadErrorComponent,
    RotationLoadingAnnouncerComponent,
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

  /**
   * Where the operator came from, when they came from somewhere that wants them back. Read once,
   * in create mode only; see `create-flow.ts` for why the two create pages hand off at all.
   */
  private readonly then: string | undefined = this.route.snapshot.queryParams?.[THEN_QUERY_PARAM];

  protected readonly editing = this.targetSystemId != null;
  protected readonly loading = signal(true);

  /** Whether the placeholder is drawn, which trails {@link loading} by the skeleton delay. */
  protected readonly showSkeleton = showSkeletonWhile(this.loading);

  /** Whether the loading branch is on screen. */
  protected readonly loadingVisible = computed(() => this.loading() || this.showSkeleton());

  /** The error from the last read of the target system, or null when it answered. */
  protected readonly loadError = signal<unknown | null>(null);

  /** Four blocks, the rough depth of the card each of these pages opens with. */
  protected readonly skeletonFields = [0, 1, 2, 3];

  protected readonly existing = signal<TargetSystem | null>(null);

  /**
   * The i18n key naming this system's integration, or null for a kind this version cannot model.
   * The list column answers the same question through the same helper.
   */
  protected readonly kindLabelKey = computed(() => targetSystemKindLabelKey(this.existing()?.kind));

  protected readonly titleText = computed(() =>
    this.i18nService.t(this.editing ? "pamTargetSystemEditTitle" : "pamTargetSystemCreateTitle"),
  );

  /** Expose const objects for template comparisons. */
  protected readonly TargetSystemMethod = TargetSystemMethod;

  /** Kind options for the bit-select in Automatic mode. */
  protected readonly kindOptions = [
    { value: TargetSystemKind.Entra, label: "pamTargetSystemKindEntra" },
    { value: TargetSystemKind.Mssql, label: "pamTargetSystemKindMssql" },
    { value: TargetSystemKind.CustomScript, label: "pamTargetSystemKindCustomScript" },
  ] as const;

  protected readonly createForm = this.formBuilder.nonNullable.group({
    name: ["", [Validators.required, Validators.maxLength(NAME_MAX_LENGTH)]],
    method: [TargetSystemMethod.Automatic as TargetSystemMethod, [Validators.required]],
    kind: [TargetSystemKind.Entra as TargetSystemKind, [Validators.required]],
  });

  /** Password-policy sub-form, shared by both methods (separate group so it can be validated on its own). */
  protected readonly policyForm = buildPolicyGroup(this.formBuilder);

  /** Live create-mode method selection — drives the Integration/policy cards reactively. */
  private readonly createMethod = toSignal(this.createForm.controls.method.valueChanges, {
    initialValue: this.createForm.controls.method.value,
  });

  /** Live create-mode kind selection — drives the session-termination presentation reactively. */
  private readonly createKind = toSignal(this.createForm.controls.kind.valueChanges, {
    initialValue: this.createForm.controls.kind.value,
  });

  /** Live session-termination checkbox state — drives the withdrawal warning reactively. */
  private readonly stagedTermination = toSignal(
    this.policyForm.controls.supportsSessionTermination.valueChanges,
    { initialValue: this.policyForm.controls.supportsSessionTermination.value },
  );

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
   * The password-policy card is shown for both methods: enforced by the daemon under Automatic,
   * followed by the operator by hand under Manual.
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

  /** Shows the session-termination withdrawal warning: edit mode only, when an existing supportsSessionTermination system is unchecked. */
  protected readonly showTerminationWarning = computed(() => {
    if (!this.editing) {
      return false;
    }
    const existing = this.existing();
    if (existing?.supportsSessionTermination !== true) {
      return false;
    }
    return !this.stagedTermination();
  });

  protected readonly nameForm = this.formBuilder.nonNullable.group({
    name: ["", [Validators.required, Validators.maxLength(NAME_MAX_LENGTH)]],
  });

  // -----------------------------------------------------------------------
  // Assigned access connectors (edit mode, Automatic only)
  // -----------------------------------------------------------------------

  /** The organization's connectors, held whole rather than pre-filtered. */
  private readonly connectors = signal<AccessConnector[]>([]);

  /** True when the connector list could not be read, so an empty card is not read as "none assigned". */
  protected readonly connectorsUnavailable = signal(false);

  /** The diff waiting on Save, held as two id lists rather than patched into {@link connectors}. */
  private readonly stagedAssigns = signal<readonly AccessConnectorId[]>([]);
  private readonly stagedUnassigns = signal<readonly AccessConnectorId[]>([]);

  /** What the server holds, before the staged diff. */
  private readonly assignedConnectors = computed(() => {
    const targetSystemId = this.targetSystemId;
    if (targetSystemId == null) {
      return [] as AccessConnector[];
    }
    return this.connectors().filter((c) => c.assignedTargetSystemIds.includes(targetSystemId));
  });

  /** What the target would hold once the staged diff is applied. */
  private readonly effectiveAssignedIds = computed(() => {
    const staged = new Set(this.stagedUnassigns());
    const kept = this.assignedConnectors()
      .map((c) => c.id)
      .filter((id) => !staged.has(id));
    return new Set([...kept, ...this.stagedAssigns()]);
  });

  /** The picker's rows: what is stored, then what is staged to be added. */
  protected readonly assignedConnectorRows = computed<ConnectorAssignmentRow[]>(() => {
    const removing = new Set(this.stagedUnassigns());
    const byId = new Map(this.connectors().map((c) => [c.id, c]));
    const stored = this.assignedConnectors().map((connector) =>
      this.connectorRow(connector, removing.has(connector.id) ? "unassign" : null),
    );
    const added = this.stagedAssigns()
      .map((id) => byId.get(id))
      .filter((connector): connector is AccessConnector => connector != null)
      .map((connector) => this.connectorRow(connector, "assign"));
    return [...stored, ...added];
  });

  private connectorRow(
    connector: AccessConnector,
    staged: StagedAssignment | null,
  ): ConnectorAssignmentRow {
    const enabled = connector.status === AccessConnectorStatus.Enabled;
    return {
      id: String(connector.id),
      label: connector.name,
      connector,
      enabled,
      statusLabelKey: accessConnectorStatusLabelKey(connector.status),
      connectionLabelKey: accessConnectorConnectionLabelKey(connector.isConnected),
      staged,
      stagedLabelKey: staged == null ? null : STAGED_LABEL_KEYS[staged],
      removing: staged === "unassign",
    };
  }

  /** Every connector the org could assign here, whatever this target already holds. */
  private readonly eligibleConnectors = computed(() =>
    this.connectors().filter((c) => c.status === AccessConnectorStatus.Enabled),
  );

  /** Enabled connectors the target would not hold after the staged diff. */
  private readonly assignableConnectors = computed(() => {
    const held = this.effectiveAssignedIds();
    return this.eligibleConnectors().filter((c) => !held.has(c.id));
  });

  protected readonly connectorOptions = computed<SelectItemView[]>(() =>
    this.assignableConnectors().map((connector) => ({
      id: String(connector.id),
      listName: connector.name,
      labelName: connector.name,
    })),
  );

  /** The org has no active connector at all, as opposed to having assigned them all here. */
  protected readonly noConnectorsEligible = computed(
    () => !this.connectorsUnavailable() && this.eligibleConnectors().length === 0,
  );

  protected readonly connectorColumns: readonly AssignmentPickerColumn[] = [
    { headerKey: "name" },
    { headerKey: "status" },
    { headerKey: "pamAccessConnectorConnection" },
  ];

  protected readonly connectorHints: AssignmentPickerHints = {
    default: "pamTargetSystemAssignConnectorSelectHint",
    noneEligible: "pamTargetSystemAssignConnectorNone",
    loadError: "pamTargetSystemConnectorAssignmentsLoadError",
    disabled: "pamTargetSystemAssignConnectorManual",
  };

  protected readonly connectorsRoute = rotationLink(
    this.organizationId,
    ROTATION_TABS.accessConnectors,
  );

  /**
   * Only an automatic target can claim a connector assignment, mirroring the target-systems tab's
   * `canAssignConnectors` row flag and `AssignAccessConnectorToTargetCommand`, which checks the
   * method alone and says nothing about the target's status.
   */
  protected readonly canAssignConnectors = computed(() => this.isAutomatic());

  // -----------------------------------------------------------------------
  // Outstanding setup (edit mode)
  // -----------------------------------------------------------------------

  /**
   * What is known about this target's managed credentials: not read yet, read and unreadable, or
   * the answer.
   */
  private readonly managedCredentials = signal<"pending" | "unavailable" | "none" | "some">(
    "pending",
  );

  /**
   * The setup steps this target has genuinely not had done yet, in the order they are worked
   * through. Empty means rotation is set up, or that nothing can be said about it yet.
   */
  protected readonly outstandingSetupSteps = computed<readonly string[]>(() => {
    const credentials = this.managedCredentials();
    if (!this.editing || !this.isActive() || credentials === "pending") {
      return [];
    }

    const steps: string[] = [];
    if (
      this.canAssignConnectors() &&
      !this.connectorsUnavailable() &&
      this.effectiveAssignedIds().size === 0
    ) {
      steps.push("pamTargetSystemSetupGuidanceAutomaticConnector");
    }
    if (credentials === "none") {
      steps.push("pamTargetSystemSetupGuidanceCredential");
    }
    return steps;
  });

  constructor() {
    void this.initialize();
  }

  /** Whether the operator has asked for a retry, which decides where focus lands on a re-render. */
  protected readonly retried = signal(false);

  protected readonly retryLoad = (): Promise<void> => {
    this.retried.set(true);
    return this.initialize();
  };

  private async initialize(): Promise<void> {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      if (this.editing) {
        void this.loadManagedCredentials();
        await Promise.all([this.loadSystem(), this.loadConnectors()]);
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

  /** Read the target system this page edits, out of the organization's list. */
  private async loadSystem({ recordFailure = true } = {}): Promise<"loaded" | "failed" | "gone"> {
    let systems: TargetSystem[];
    try {
      systems = (await this.rotationSdk.listTargetSystems(this.organizationId)) ?? [];
    } catch (e) {
      if (recordFailure) {
        this.loadError.set(e);
      }
      return "failed";
    }

    const routeId = uuidAsString(this.targetSystemId!).toLowerCase();
    const system = systems.find((s) => uuidAsString(s.id).toLowerCase() === routeId);
    if (system == null) {
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("pamTargetSystemNotFound"),
      });
      await this.navigateToList();
      return "gone";
    }
    this.existing.set(system);
    this.applySystem(system);
    return "loaded";
  }

  /** Read the organization's access connectors for the assignment card. */
  private async loadConnectors(): Promise<void> {
    try {
      this.connectors.set((await this.rotationSdk.listConnectors(this.organizationId)) ?? []);
      this.connectorsUnavailable.set(false);
    } catch {
      this.connectors.set([]);
      this.connectorsUnavailable.set(true);
    }
  }

  /** Answer whether this target already has a managed credential, for the outstanding-setup hint. */
  private async loadManagedCredentials(): Promise<void> {
    const routeId = uuidAsString(this.targetSystemId!).toLowerCase();
    try {
      const configs = (await this.rotationSdk.listConfigs(this.organizationId)) ?? [];
      const found = configs.some(
        (config) => uuidAsString(config.targetSystemId).toLowerCase() === routeId,
      );
      this.managedCredentials.set(found ? "some" : "none");
    } catch {
      this.managedCredentials.set("unavailable");
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

    if (this.createForm.invalid || this.policyForm.invalid) {
      return;
    }

    const { name } = this.createForm.getRawValue();
    const passwordPolicy = this.buildPasswordPolicy();

    try {
      const created =
        method === TargetSystemMethod.Automatic
          ? await this.rotationSdk.createTargetSystem(this.organizationId, {
              method: "automatic",
              name,
              kind: this.createForm.controls.kind.value,
              passwordPolicy,
              supportsSessionTermination: this.resolvedSessionTermination(),
            })
          : // A manual target has no integration and no session to terminate, so the union's
            // manual arm carries neither.
            await this.rotationSdk.createTargetSystem(this.organizationId, {
              method: "manual",
              name,
              passwordPolicy,
            });
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamTargetSystemCreated"),
      });
      await this.navigateAfterCreate(created);
    } catch (e) {
      this.showError(e);
    }
  };

  /**
   * Where to land once the target exists: normally the list, but back to the managed-credential
   * create page when that page sent the operator here, with the new target selected.
   */
  private navigateAfterCreate(created: TargetSystem): Promise<boolean> {
    if (this.then !== THEN_MANAGED_CREDENTIAL) {
      return this.navigateToList();
    }
    this.markLiveFormsPristine();
    return this.router.navigate(["managed-credentials", "new"], {
      relativeTo: this.route.parent,
      queryParams: { [TARGET_SYSTEM_QUERY_PARAM]: created.id },
    });
  }

  /**
   * Edit mode: the page's one save. Persists the name and the password policy in a single write,
   * then applies whatever connector assignments were staged against it.
   */
  protected readonly submitEdit = async (): Promise<void> => {
    this.nameForm.markAllAsTouched();
    this.policyForm.markAllAsTouched();

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
    } catch (e) {
      this.showError(e);
      return;
    }

    const staged = this.stagedAssigns().length + this.stagedUnassigns().length > 0;
    const failure = await this.applyStagedAssignments();

    // The writes answer with no content, so re-read rather than assume the request bodies are now
    // the stored state.
    const rereadSystem = this.loadSystem({ recordFailure: false });
    const rereadConnectors = staged ? this.loadConnectors() : Promise.resolve();
    const reread = await rereadSystem;
    await rereadConnectors;

    if (reread === "gone") {
      return;
    }

    if (failure != null) {
      this.showError(failure.error);
      return;
    }

    this.markLiveFormsPristine();
    this.toastService.showToast({
      variant: reread === "failed" ? "warning" : "success",
      message: this.i18nService.t(
        reread === "failed" ? "pamTargetSystemSavedNotReread" : "pamTargetSystemSaved",
      ),
    });
  };

  /** Write the staged assignment diff, one connector at a time. */
  private async applyStagedAssignments(): Promise<{ error: unknown } | undefined> {
    const targetSystemId = this.targetSystemId;
    if (targetSystemId == null) {
      return undefined;
    }

    const unassigned = await this.writeEach(this.stagedUnassigns(), (connectorId) =>
      this.rotationSdk.unassignTarget(this.organizationId, connectorId, targetSystemId),
    );
    const assigned = await this.writeEach(this.stagedAssigns(), (connectorId) =>
      this.rotationSdk.assignTarget(this.organizationId, connectorId, targetSystemId),
    );

    this.stagedUnassigns.set(unassigned.failed);
    this.stagedAssigns.set(assigned.failed);
    return unassigned.failure ?? assigned.failure;
  }

  /** Runs `write` over `connectorIds` in order, collecting the refusals rather than stopping. */
  private async writeEach(
    connectorIds: readonly AccessConnectorId[],
    write: (connectorId: AccessConnectorId) => Promise<void>,
  ): Promise<{ failed: AccessConnectorId[]; failure?: { error: unknown } }> {
    let failure: { error: unknown } | undefined;
    const failed: AccessConnectorId[] = [];
    for (const connectorId of connectorIds) {
      try {
        await write(connectorId);
      } catch (e) {
        failure ??= { error: e };
        failed.push(connectorId);
      }
    }
    return { failed, failure };
  }

  /**
   * Whether the loaded system is currently in service. Picks which of the paired retirement
   * actions the edit footer offers. Only read from the edit branch, which renders after
   * {@link loadSystem} has resolved, so the unloaded case never reaches the template.
   */
  protected readonly isActive = computed(
    () => this.existing()?.status === TargetSystemStatus.Active,
  );

  /**
   * Stage the picked connectors for assignment, and resolve with what was staged so the picker
   * clears them from its selection.
   */
  protected readonly stageAssign = async (
    selected: SelectItemView[],
  ): Promise<readonly string[]> => {
    const assignable = new Map(this.assignableConnectors().map((c) => [String(c.id), c]));
    const picked = selected
      .map((item) => assignable.get(item.id))
      .filter((connector): connector is AccessConnector => connector != null)
      .map((connector) => connector.id);
    if (picked.length === 0) {
      return [];
    }

    const removing = new Set(this.stagedUnassigns());
    const restored = picked.filter((id) => removing.has(id));
    const added = picked.filter((id) => !removing.has(id));
    if (restored.length > 0) {
      const cancelled = new Set(restored);
      this.stagedUnassigns.update((ids) => ids.filter((id) => !cancelled.has(id)));
    }
    if (added.length > 0) {
      this.stagedAssigns.update((ids) => [...ids, ...added]);
    }
    this.markAssignmentsDirty();
    return picked.map((id) => String(id));
  };

  /** Stage one row's removal, or drop the staged assignment that put it there. */
  protected readonly stageUnassign = async (row: ConnectorAssignmentRow): Promise<boolean> => {
    const connectorId = row.connector.id;
    if (this.stagedAssigns().includes(connectorId)) {
      this.stagedAssigns.update((ids) => ids.filter((id) => id !== connectorId));
      this.markAssignmentsDirty();
      return true;
    }
    if (this.stagedUnassigns().includes(connectorId)) {
      return false;
    }
    this.stagedUnassigns.update((ids) => [...ids, connectorId]);
    this.markAssignmentsDirty();
    return true;
  };

  private markAssignmentsDirty(): void {
    this.nameForm.markAsDirty();
  }

  /** Permanently delete this target system, then leave the page. */
  protected readonly deleteSystem = async (): Promise<void> => {
    const system = this.existing();
    if (system == null) {
      return;
    }
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "pamTargetSystemDeleteTitle" },
      content: {
        key:
          this.assignedConnectors().length > 0
            ? "pamTargetSystemDeleteAssignedConnectorsContent"
            : "pamTargetSystemDeleteContentDeactivateInstead",
        placeholders: [system.name],
      },
      acceptButtonText: { key: "delete" },
      cancelButtonText: { key: "cancel" },
      type: "danger",
    });
    if (!confirmed) {
      return;
    }
    try {
      await this.rotationSdk.deleteTargetSystem(this.organizationId, system.id);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamTargetSystemDeleteSuccess"),
      });
      await this.navigateToList();
    } catch (e) {
      this.showError(e);
    }
  };

  /** The form groups that hold user input for the current mode. */
  private liveForms(): AbstractControl[] {
    return [this.editing ? this.nameForm : this.createForm, this.policyForm];
  }

  private markLiveFormsPristine(): void {
    this.liveForms().forEach((form) => form.markAsPristine());
  }

  /**
   * Confirm before unsaved input is thrown away. Called both by Cancel and by the route's
   * CanDeactivate guard, which covers the breadcrumb and browser back/forward.
   */
  async confirmDiscard(): Promise<boolean> {
    if (!this.liveForms().some((form) => form.dirty)) {
      return true;
    }

    return await this.dialogService.openSimpleDialog(
      discardConfirmOptions({
        editing: this.editing,
        createTitleKey: "pamTargetSystemDiscardTitle",
      }),
    );
  }

  protected readonly cancel = async (): Promise<void> => {
    if (!(await this.confirmDiscard())) {
      return;
    }

    await this.navigateToList();
  };

  private navigateToList(): Promise<boolean> {
    this.markLiveFormsPristine();
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
