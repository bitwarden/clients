import { TemplatePortal } from "@angular/cdk/portal";
import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnDestroy,
  TemplateRef,
  ViewContainerRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
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
import { merge } from "rxjs";

import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { asUuid, uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  AsyncActionsModule,
  BadgeModule,
  BadgeVariant,
  BitwardenIcon,
  ButtonModule,
  CalloutModule,
  CardComponent,
  CheckboxModule,
  CopyClickDirective,
  DialogService,
  FormFieldModule,
  HeaderComponent,
  IconButtonModule,
  IconModule,
  IconTileComponent,
  IconTileVariant,
  LayoutFooterService,
  MultiSelectModule,
  RadioButtonModule,
  SectionComponent,
  SectionHeaderComponent,
  SelectItemView,
  SelectModule,
  SkeletonComponent,
  SkeletonTextComponent,
  TabsModule,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { apiErrorBodyMessage } from "../../abstractions/api-error";
import { HasUnsavedChangesDialog } from "../../unsaved-changes.guard";
import {
  TARGET_SYSTEM_QUERY_PARAM,
  THEN_MANAGED_CREDENTIAL,
  THEN_QUERY_PARAM,
} from "../create-flow";
import { DetailBreadcrumbComponent, DetailBreadcrumbStep } from "../detail-breadcrumb.component";
import {
  AccessConnector,
  AccessConnectorId,
  AccessConnectorStatus,
  PasswordPolicy,
  TargetSystemCreateRequest,
  TargetSystemId,
  TargetSystemKind,
  TargetSystemMethod,
  TargetSystemStatus,
  TargetSystemView,
} from "../rotation";
import { classifyRotationError, targetSystemCreatePendingId } from "../rotation-error";
import { ROTATION_TABS, rotationLink } from "../rotation-links";
import { RotationLoadErrorComponent } from "../rotation-load-error.component";
import { RotationLoadingAnnouncerComponent } from "../rotation-loading-announcer.component";
import { RotationSdkService } from "../rotation-sdk.service";
import { showSkeletonWhile } from "../skeleton-delay";

import { targetSystemKindLabelKey } from "./target-system-label";
import { resolveTargetSystemStatus, targetSystemStatusBadge } from "./target-system-status";

const NAME_MAX_LENGTH = 200;
const DEFAULT_MIN_LENGTH = 14;
const DEFAULT_MAX_LENGTH = 64;

/**
 * The generator's supported length range (`bitwarden_pam_sealed::GENERATOR_MIN_LENGTH`/
 * `GENERATOR_MAX_LENGTH`), mirrored here to catch an out-of-range policy while editing.
 */
const GENERATOR_MIN_LENGTH = 5;
const GENERATOR_MAX_LENGTH = 128;

/**
 * The character pool sizes the connector's generator draws from, mirroring
 * `bitwarden_pam_sealed::SealedPasswordPolicy::character_pool_size`.
 */
const UPPERCASE_POOL_SIZE = 26;
const LOWERCASE_POOL_SIZE = 26;
const DIGIT_POOL_SIZE = 10;
const SYMBOL_POOL_SIZE = 8;

/**
 * The shared PAM strength floor (`bitwarden_pam_sealed::MIN_PASSWORD_ENTROPY_BITS`). Sealing
 * doesn't stop a replayed weak policy, so both this form and the SDK enforce it independently.
 */
const MIN_PASSWORD_ENTROPY_BITS = 80;

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

const minMaxValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const group = control as PolicyGroup;
  const min = group.controls.minLength.value;
  const max = group.controls.maxLength.value;
  return min > max ? { minExceedsMax: true } : null;
};

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
 * The entropy, in bits, of a generated password under this policy: `length × log2(pool)`, length
 * clamped to the generator's range. Mirrors `SealedPasswordPolicy::entropy_bits`.
 */
function passwordPolicyEntropyBits(policy: {
  maxLength: number;
  includeUppercase: boolean;
  includeLowercase: boolean;
  includeDigits: boolean;
  includeSymbols: boolean;
}): number {
  const pool =
    (policy.includeUppercase ? UPPERCASE_POOL_SIZE : 0) +
    (policy.includeLowercase ? LOWERCASE_POOL_SIZE : 0) +
    (policy.includeDigits ? DIGIT_POOL_SIZE : 0) +
    (policy.includeSymbols ? SYMBOL_POOL_SIZE : 0);
  if (pool === 0) {
    return 0;
  }
  const length = Math.min(Math.max(policy.maxLength, GENERATOR_MIN_LENGTH), GENERATOR_MAX_LENGTH);
  return length * Math.log2(pool);
}

/**
 * Catches a policy the SDK would refuse as too weak. Skips while {@link characterClassValidator}
 * already flags no class enabled, so the two don't double up on one cause.
 */
const strengthFloorValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const group = control as PolicyGroup;
  const value = group.getRawValue();
  const anyEnabled =
    value.includeUppercase || value.includeLowercase || value.includeDigits || value.includeSymbols;
  if (!anyEnabled) {
    return null;
  }
  return passwordPolicyEntropyBits(value) < MIN_PASSWORD_ENTROPY_BITS
    ? { belowStrengthFloor: true }
    : null;
};

type ConnectorDisplay = {
  badgeVariant: BadgeVariant;
  badgeIcon: BitwardenIcon;
  badgeLabelKey: string;
  tileVariant: IconTileVariant;
  tileIcon: BitwardenIcon;
  /** Active and connected, so it can rotate. */
  usable: boolean;
};

/** How an assigned access connector reads: Inactive outranks the connection state. */
function connectorDisplay(connector: AccessConnector): ConnectorDisplay {
  if (connector.status !== AccessConnectorStatus.Enabled) {
    return {
      badgeVariant: "subtle",
      badgeIcon: "bwi-minus-circle",
      badgeLabelKey: "inactive",
      tileVariant: "gray",
      tileIcon: "bwi-minus-circle",
      usable: false,
    };
  }
  return connector.isConnected
    ? {
        badgeVariant: "success",
        badgeIcon: "bwi-check-circle",
        badgeLabelKey: "pamAccessConnectorConnected",
        tileVariant: "success",
        tileIcon: "bwi-check",
        usable: true,
      }
    : {
        badgeVariant: "warning",
        badgeIcon: "bwi-warning",
        badgeLabelKey: "pamAccessConnectorDisconnected",
        tileVariant: "warning",
        tileIcon: "bwi-exclamation-triangle",
        usable: false,
      };
}

function buildPolicyGroup(fb: FormBuilder): PolicyGroup {
  return new FormGroup<PolicyControls>(
    {
      minLength: fb.nonNullable.control(DEFAULT_MIN_LENGTH, [
        Validators.required,
        Validators.min(GENERATOR_MIN_LENGTH),
        Validators.max(GENERATOR_MAX_LENGTH),
      ]),
      maxLength: fb.nonNullable.control(DEFAULT_MAX_LENGTH, [
        Validators.required,
        Validators.min(GENERATOR_MIN_LENGTH),
        Validators.max(GENERATOR_MAX_LENGTH),
      ]),
      includeUppercase: fb.nonNullable.control(true),
      includeLowercase: fb.nonNullable.control(true),
      includeDigits: fb.nonNullable.control(true),
      includeSymbols: fb.nonNullable.control(true),
      supportsSessionTermination: fb.nonNullable.control(false),
    },
    { validators: [minMaxValidator, characterClassValidator, strengthFloorValidator] },
  );
}

/** Routed create and edit page for a target system. */
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
    CopyClickDirective,
    FormFieldModule,
    HeaderComponent,
    IconButtonModule,
    IconModule,
    IconTileComponent,
    MultiSelectModule,
    RadioButtonModule,
    SectionComponent,
    SectionHeaderComponent,
    SelectModule,
    SkeletonComponent,
    SkeletonTextComponent,
    TabsModule,
    TypographyModule,
    RotationLoadErrorComponent,
    RotationLoadingAnnouncerComponent,
    I18nPipe,
  ],
})
export class TargetSystemEditComponent implements HasUnsavedChangesDialog, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);
  private readonly rotationSdk = inject(RotationSdkService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly i18nService = inject(I18nService);

  private readonly organizationId = this.route.snapshot.params.organizationId as OrganizationId;
  private readonly targetSystemId: TargetSystemId | undefined =
    this.route.snapshot.params.targetSystemId == null
      ? undefined
      : asUuid<TargetSystemId>(this.route.snapshot.params.targetSystemId);

  /** Set when the managed-credential create page sent the operator here, to go back there. */
  private readonly then: string | undefined = this.route.snapshot.queryParams?.[THEN_QUERY_PARAM];

  protected readonly editing = this.targetSystemId != null;

  /** Whether the admin came from the add-managed-credential form and goes back to it. */
  protected readonly returnsToCredential = this.then === THEN_MANAGED_CREDENTIAL;

  private readonly credentialsListRoute = rotationLink(
    this.organizationId,
    ROTATION_TABS.managedCredentials,
  );

  protected readonly managedCredentialsTabRoute = this.credentialsListRoute;

  private readonly addCredentialRoute = [...this.credentialsListRoute, "new"];

  protected readonly breadcrumbParentKey = this.returnsToCredential
    ? "pamRotationTabManagedCredentials"
    : "pamRotationTabTargetSystems";
  protected readonly breadcrumbParentRoute: unknown[] = this.returnsToCredential
    ? this.credentialsListRoute
    : [".."];
  protected readonly breadcrumbParentIcon = this.returnsToCredential
    ? ("bwi-managed-credential" as const)
    : undefined;
  protected readonly breadcrumbStep: DetailBreadcrumbStep | undefined = this.returnsToCredential
    ? {
        labelKey: "pamRotationConfigCreateTitle",
        route: this.addCredentialRoute,
        tileIcon: "bwi-plus",
      }
    : undefined;
  protected readonly loading = signal(true);

  /** Whether the placeholder is drawn, which trails {@link loading} by the skeleton delay. */
  protected readonly showSkeleton = showSkeletonWhile(this.loading);

  protected readonly loadingVisible = computed(() => this.loading() || this.showSkeleton());

  protected readonly loadError = signal<unknown | null>(null);

  /** Four blocks, the rough depth of the card each of these pages opens with. */
  protected readonly skeletonFields = [0, 1, 2, 3];

  protected readonly existing = signal<TargetSystemView | null>(null);

  /** The id an access connector's config file keys this target's rotation script on. */
  protected readonly systemIdText = computed(() => {
    const id = this.existing()?.id;
    return id == null ? null : uuidAsString(id);
  });

  protected readonly kindLabelKey = computed(() =>
    targetSystemKindLabelKey(this.existing()?.sealed?.kind),
  );

  /** The target's own name once loaded, so the page reads as that record rather than a form. */
  protected readonly titleText = computed(() => {
    if (!this.editing) {
      return this.i18nService.t("pamTargetSystemCreateTitle");
    }
    return this.existing()?.name ?? this.i18nService.t("pamTargetSystemEditTitle");
  });

  /** The detail page's own tab, which stays active here. */
  protected readonly configurationTabRoute =
    this.targetSystemId == null
      ? []
      : rotationLink(
          this.organizationId,
          ROTATION_TABS.targetSystems,
          uuidAsString(this.targetSystemId),
        );

  /** The Managed credentials tab opens that list scoped to this target system. */
  protected readonly managedCredentialsTabQuery =
    this.targetSystemId == null
      ? {}
      : { [TARGET_SYSTEM_QUERY_PARAM]: uuidAsString(this.targetSystemId) };

  protected readonly TargetSystemMethod = TargetSystemMethod;

  protected readonly kindOptions = [
    { value: TargetSystemKind.Entra, label: "pamTargetSystemTypeEntra" },
    { value: TargetSystemKind.CustomScript, label: "pamTargetSystemTypeCustomScript" },
  ] as const;

  protected readonly createForm = this.formBuilder.nonNullable.group({
    name: ["", [Validators.required, Validators.maxLength(NAME_MAX_LENGTH)]],
    method: [TargetSystemMethod.Automatic as TargetSystemMethod, [Validators.required]],
    // Starts unset so the picker shows its prompt instead of silently choosing an integration.
    kind: this.formBuilder.control<TargetSystemKind | null>(null, [Validators.required]),
  });

  /** Shared by both methods, and a separate group so it validates on its own. */
  protected readonly policyForm = buildPolicyGroup(this.formBuilder);

  private readonly createMethod = toSignal(this.createForm.controls.method.valueChanges, {
    initialValue: this.createForm.controls.method.value,
  });

  private readonly createKind = toSignal(this.createForm.controls.kind.valueChanges, {
    initialValue: this.createForm.controls.kind.value,
  });

  private readonly method = computed<TargetSystemMethod | null>(() => {
    if (this.editing) {
      return this.existing()?.method ?? null;
    }
    return this.createMethod();
  });

  /** Gates the integration and session-termination controls, which a manual target lacks. */
  protected readonly isAutomatic = computed(() => this.method() === TargetSystemMethod.Automatic);

  /** Gates the "rotate by hand" password-rules hint. */
  protected readonly isManual = computed(() => this.method() === TargetSystemMethod.Manual);

  /**
   * Both known methods use the policy: the access connector enforces it under Automatic, and the
   * operator follows it under Manual.
   */
  protected readonly showPolicyCard = computed(() => this.isAutomatic() || this.isManual());

  /** `existing`'s verified sealed fields, or `null` while not yet loaded or unverified. */
  protected readonly sealed = computed(() => this.existing()?.sealed ?? null);

  /**
   * Why {@link sealed} is unavailable: `pending` is a target that never finished sealing (fixed by
   * re-saving this form), `invalid` is a blob that failed to verify, `ok` is nothing to report.
   */
  protected readonly sealIssue = computed<"ok" | "pending" | "invalid">(() => {
    const existing = this.existing();
    if (existing == null || existing.sealed != null) {
      return "ok";
    }
    return existing.status === TargetSystemStatus.PendingSeal ? "pending" : "invalid";
  });

  /** Picks the integration when finishing or re-saving a target with no sealed `kind` to resend. */
  protected readonly editKindControl = this.formBuilder.nonNullable.control<TargetSystemKind>(
    TargetSystemKind.Entra,
  );

  private readonly editKind = toSignal(this.editKindControl.valueChanges, {
    initialValue: this.editKindControl.value,
  });

  /** Only shown in edit mode, for an automatic target with no sealed `kind` to fall back on. */
  protected readonly showEditKindPicker = computed(
    () => this.editing && this.isAutomatic() && this.sealed() == null,
  );

  private readonly selectedKind = computed<TargetSystemKind | null>(() => {
    if (!this.isAutomatic()) {
      return null;
    }
    if (!this.editing) {
      return this.createKind();
    }
    return this.sealed()?.kind ?? this.editKind();
  });

  /**
   * Native integrations always terminate sessions after rotating, so the form shows a static
   * "Supported" instead of a checkbox.
   */
  protected readonly isNativeIntegration = computed(() => {
    const kind = this.selectedKind();
    return kind != null && kind !== TargetSystemKind.CustomScript;
  });

  /** A custom script cannot be assumed to end sessions, so the create form says so. */
  protected readonly isCustomScript = computed(
    () => this.selectedKind() === TargetSystemKind.CustomScript,
  );

  /**
   * Whether the target ends sessions after rotating: always for a native integration, and for a
   * custom script only when its verified settings say so.
   */
  protected readonly endsSessions = computed(
    () => this.isNativeIntegration() || this.sealed()?.supportsSessionTermination === true,
  );

  protected readonly nameForm = this.formBuilder.nonNullable.group({
    name: ["", [Validators.required, Validators.maxLength(NAME_MAX_LENGTH)]],
  });

  /** The organization's connectors, held whole rather than pre-filtered. */
  private readonly connectors = signal<AccessConnector[]>([]);

  /** Set when the connector read fails, so an empty card doesn't read as "none assigned". */
  protected readonly connectorsUnavailable = signal(false);

  /**
   * What the server holds. Ids are compared lowercased, since the route's id is text and may
   * differ in case from the connector read's.
   */
  private readonly assignedConnectors = computed(() => {
    const targetSystemId = this.targetSystemId;
    if (targetSystemId == null) {
      return [] as AccessConnector[];
    }
    const routeId = uuidAsString(targetSystemId).toLowerCase();
    return this.connectors().filter((c) =>
      c.assignedTargetSystemIds.some((id) => uuidAsString(id).toLowerCase() === routeId),
    );
  });

  /** The picks the target would hold once saved; it starts out as {@link assignedConnectors}. */
  private readonly chosenIds = computed(() => new Set(this.chosenConnectors().map((c) => c.id)));

  /** Chosen but not yet held: written on Save. */
  private readonly stagedAssigns = computed(() => {
    const held = new Set(this.assignedConnectors().map((c) => c.id));
    return this.chosenConnectors()
      .map((c) => c.id)
      .filter((id) => !held.has(id));
  });

  /** Held but no longer chosen: written on Save. */
  private readonly stagedUnassigns = computed(() => {
    const chosen = this.chosenIds();
    return this.assignedConnectors()
      .map((c) => c.id)
      .filter((id) => !chosen.has(id));
  });

  /** Every connector the org could assign here: enabled ones, plus any this target already holds. */
  private readonly eligibleConnectors = computed(() => {
    const held = new Set(this.assignedConnectors().map((c) => c.id));
    return this.connectors().filter(
      (c) => c.status === AccessConnectorStatus.Enabled || held.has(c.id),
    );
  });

  /** The create form's picks; nothing is assigned until the target exists. */
  protected readonly connectorsControl = this.formBuilder.nonNullable.control<SelectItemView[]>([]);

  private readonly chosenConnectorItems = toSignal(this.connectorsControl.valueChanges, {
    initialValue: this.connectorsControl.value,
  });

  protected readonly createConnectorOptions = computed<SelectItemView[]>(() =>
    this.eligibleConnectors().map((connector) => ({
      id: String(connector.id),
      listName: connector.name,
      labelName: connector.name,
      icon: "bwi-access-connector",
      iconTile: {
        icon: connectorDisplay(connector).tileIcon,
        variant: connectorDisplay(connector).tileVariant,
      },
    })),
  );

  protected readonly chosenConnectors = computed(() => {
    const byId = new Map(this.connectors().map((c) => [String(c.id), c]));
    return this.chosenConnectorItems()
      .map((item) => byId.get(item.id))
      .filter((connector): connector is AccessConnector => connector != null);
  });

  /** The picks as list rows, each with the state badge the design draws beside it. */
  protected readonly chosenConnectorRows = computed(() =>
    this.chosenConnectors().map((connector) => ({
      id: connector.id,
      name: connector.name,
      ...connectorDisplay(connector),
    })),
  );

  /** Whether the picks include one that is both active and connected, which rotation needs. */
  protected readonly noneChosenConnected = computed(() => {
    const chosen = this.chosenConnectors();
    if (chosen.length === 0) {
      return false;
    }
    return !chosen.some((c) => connectorDisplay(c).usable);
  });

  /** An edited automatic target with every connector removed; the design warns right away. */
  protected readonly noneAssigned = computed(
    () =>
      this.editing &&
      this.isAutomatic() &&
      this.connectorsLoaded() &&
      !this.connectorsUnavailable() &&
      this.chosenConnectors().length === 0,
  );

  /** The org has no access connectors of any kind, so there is nothing to choose. */
  protected readonly orgHasNoConnectors = computed(
    () => this.connectorsLoaded() && this.connectors().length === 0,
  );

  private readonly connectorsLoaded = signal(false);

  /**
   * The status badge the header shows once an existing target has loaded, the same one the table
   * shows. The org's connectors decide Not connected, so an unread or failed list leaves it out of
   * play rather than reading as no connector.
   */
  protected readonly statusBadge = computed(() => {
    const existing = this.existing();
    if (!this.editing || existing == null) {
      return null;
    }
    if (
      !this.connectorsLoaded() &&
      existing.method === TargetSystemMethod.Automatic &&
      existing.status === TargetSystemStatus.Active
    ) {
      return null;
    }
    const connectors =
      this.connectorsLoaded() && !this.connectorsUnavailable() ? this.connectors() : null;
    return targetSystemStatusBadge(resolveTargetSystemStatus(existing, connectors));
  });

  protected readonly removeChosenConnector = (connectorId: AccessConnectorId): void => {
    // Dirty first, so the footer's subscription sees the change as the value emits.
    this.connectorsControl.markAsDirty();
    this.connectorsControl.setValue(
      this.connectorsControl.value.filter((item) => item.id !== String(connectorId)),
    );
  };

  private readonly managedCredentials = signal<"pending" | "unavailable" | "none" | "some">(
    "pending",
  );

  /** How many managed credentials name this target; `null` until read, or when the read failed. */
  private readonly managedCredentialCount = signal<number | null>(null);

  /** The setup steps this target still needs, in order; empty when set up or not yet known. */
  protected readonly outstandingSetupSteps = computed<readonly string[]>(() => {
    const credentials = this.managedCredentials();
    if (!this.editing || !this.isActive() || credentials === "pending") {
      return [];
    }

    // The connector step is the Access connectors field's own warning now, so it isn't repeated.
    const steps: string[] = [];
    if (credentials === "none") {
      steps.push("pamTargetSystemSetupGuidanceCredential");
    }
    return steps;
  });

  constructor() {
    merge(
      this.nameForm.valueChanges,
      this.policyForm.valueChanges,
      this.connectorsControl.valueChanges,
      this.editKindControl.valueChanges,
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.dirty.set(this.unsavedChanges()));

    // The save bar lives in the layout's footer region, outside the scrolling content, so it
    // stays pinned while the page scrolls. It exists only while there is something to save.
    effect(() => {
      const template = this.footerTemplate();
      if (template == null) {
        return;
      }
      if (!this.showFooter()) {
        this.detachFooter();
      } else if (this.footerPortal() == null) {
        const portal = new TemplatePortal(template, this.viewContainerRef);
        this.footerPortal.set(portal);
        this.layoutFooter.attach(portal);
      }
    });

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
        this.seedConnectorSelection();
      } else {
        this.applyTemplate(this.route.snapshot.queryParams?.["template"] as string | undefined);
        void this.loadConnectors();
      }
    } finally {
      this.loading.set(false);
    }
  }

  /** Seeds the create form from an empty-state template; unknown values keep the defaults. */
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

  /** There is no by-id read, so this finds the target in the organization's list. */
  private async loadSystem({ recordFailure = true } = {}): Promise<"loaded" | "failed" | "gone"> {
    let systems: TargetSystemView[];
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

  /**
   * Fills the picker with what the target holds, as the saved state the edit is measured against.
   * Left alone while the connector read failed, so an empty picker can't read as "remove them all".
   */
  private seedConnectorSelection(): void {
    if (!this.editing || this.connectorsUnavailable()) {
      return;
    }
    this.connectorsControl.setValue(
      this.createConnectorOptions().filter((option) =>
        this.assignedConnectors().some((c) => String(c.id) === option.id),
      ),
    );
    this.connectorsControl.markAsPristine();
  }

  private async loadConnectors(): Promise<void> {
    try {
      this.connectors.set((await this.rotationSdk.listConnectors(this.organizationId)) ?? []);
      this.connectorsUnavailable.set(false);
    } catch {
      this.connectors.set([]);
      this.connectorsUnavailable.set(true);
    }
    this.connectorsLoaded.set(true);
  }

  private async loadManagedCredentials(): Promise<void> {
    const routeId = uuidAsString(this.targetSystemId!).toLowerCase();
    try {
      const configs = (await this.rotationSdk.listConfigs(this.organizationId)) ?? [];
      const count = configs.filter(
        (config) => uuidAsString(config.targetSystemId).toLowerCase() === routeId,
      ).length;
      this.managedCredentialCount.set(count);
      this.managedCredentials.set(count > 0 ? "some" : "none");
    } catch {
      this.managedCredentialCount.set(null);
      this.managedCredentials.set("unavailable");
    }
  }

  private applySystem(system: TargetSystemView): void {
    this.nameForm.patchValue({ name: system.name });
    const sealed = system.sealed;
    if (sealed == null) {
      // Nothing trustworthy to prefill; sealIssue banners why.
      return;
    }
    this.policyForm.patchValue({
      minLength: sealed.passwordPolicy.minLength,
      maxLength: sealed.passwordPolicy.maxLength,
      includeUppercase: sealed.passwordPolicy.includeUppercase,
      includeLowercase: sealed.passwordPolicy.includeLowercase,
      includeDigits: sealed.passwordPolicy.includeDigits,
      includeSymbols: sealed.passwordPolicy.includeSymbols,
      supportsSessionTermination: sealed.supportsSessionTermination ?? false,
    });
  }

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
   * Native integrations always support it and custom scripts follow the checkbox. Only meaningful
   * for an automatic target.
   */
  private resolvedSessionTermination(): boolean {
    return this.isNativeIntegration() || this.policyForm.controls.supportsSessionTermination.value;
  }

  protected readonly submitCreate = async (): Promise<void> => {
    this.createForm.markAllAsTouched();
    this.policyForm.markAllAsTouched();
    const method = this.createForm.controls.method.value;

    const controls = this.createForm.controls;
    // A manual target has no integration, so an unset system type only blocks an automatic one.
    const kindInvalid = method === TargetSystemMethod.Automatic && controls.kind.invalid;
    if (
      controls.name.invalid ||
      controls.method.invalid ||
      kindInvalid ||
      this.policyForm.invalid
    ) {
      return;
    }

    const { name } = this.createForm.getRawValue();
    const kind = controls.kind.value;
    const passwordPolicy = this.buildPasswordPolicy();

    try {
      const created =
        method === TargetSystemMethod.Automatic
          ? await this.rotationSdk.createTargetSystem(this.organizationId, {
              method: "automatic",
              name,
              kind: kind as TargetSystemKind,
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
      const assignmentFailure =
        method === TargetSystemMethod.Automatic ? await this.assignChosenConnectors(created) : null;
      if (assignmentFailure != null) {
        this.markLiveFormsPristine();
        this.showError(assignmentFailure.error);
        await this.router.navigate(["target-systems", created.id], {
          relativeTo: this.route.parent,
        });
        return;
      }
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t(
          this.returnsToCredential ? "pamTargetSystemAdded" : "pamTargetSystemCreated",
        ),
      });
      await this.navigateAfterCreate(created);
    } catch (e) {
      const pendingId = targetSystemCreatePendingId(e);
      if (pendingId != null) {
        // The row already exists (pending_seal); route to its edit page rather than a dead create form.
        this.toastService.showToast({
          variant: "warning",
          message: this.i18nService.t("pamTargetSystemCreatePartialFailure"),
        });
        this.markLiveFormsPristine();
        await this.router.navigate(["target-systems", pendingId], {
          relativeTo: this.route.parent,
        });
        return;
      }
      this.showError(e);
    }
  };

  private async assignChosenConnectors(
    created: TargetSystemView,
  ): Promise<{ error: unknown } | null> {
    const chosen = this.chosenConnectors();
    const { failure } = await this.writeEach(
      chosen.map((connector) => connector.id),
      (connectorId) => this.rotationSdk.assignTarget(this.organizationId, connectorId, created.id),
    );
    return failure ?? null;
  }

  private navigateAfterCreate(created: TargetSystemView): Promise<boolean> {
    if (!this.returnsToCredential) {
      return this.navigateToList();
    }
    this.markLiveFormsPristine();
    return this.router.navigate(["managed-credentials", "new"], {
      relativeTo: this.route.parent,
      queryParams: { [TARGET_SYSTEM_QUERY_PARAM]: created.id },
    });
  }

  /**
   * Builds the create-shaped request `updateTargetSystem` requires, with immutable `method`/`kind`
   * resupplied via {@link selectedKind}. `null` if `existing` hasn't loaded.
   */
  private buildUpdateRequest(name: string): TargetSystemCreateRequest | null {
    const existing = this.existing();
    if (existing == null) {
      return null;
    }
    const passwordPolicy = this.buildPasswordPolicy();
    if (existing.method === TargetSystemMethod.Manual) {
      return { method: "manual", name, passwordPolicy };
    }
    return {
      method: "automatic",
      name,
      kind: this.selectedKind() ?? TargetSystemKind.Entra,
      passwordPolicy,
      supportsSessionTermination: this.resolvedSessionTermination(),
    };
  }

  /** Saves name, policy and capability in one write, then applies the staged assignments. */
  protected readonly submitEdit = async (): Promise<void> => {
    this.nameForm.markAllAsTouched();
    this.policyForm.markAllAsTouched();

    if (this.nameForm.invalid || this.policyForm.invalid) {
      return;
    }

    const { name } = this.nameForm.getRawValue();
    const request = this.buildUpdateRequest(name);
    if (request == null) {
      return;
    }
    if (!(await this.confirmRemovingLastConnector())) {
      return;
    }
    try {
      await this.rotationSdk.updateTargetSystem(this.organizationId, this.targetSystemId!, request);
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

    this.seedConnectorSelection();
    this.markLiveFormsPristine();
    this.toastService.showToast({
      variant: reread === "failed" ? "warning" : "success",
      message: this.i18nService.t(
        reread === "failed" ? "pamTargetSystemSavedNotReread" : "pamTargetSystemSaved",
      ),
    });
  };

  private async applyStagedAssignments(): Promise<{ error: unknown } | undefined> {
    const targetSystemId = this.targetSystemId;
    if (targetSystemId == null) {
      return undefined;
    }

    const unassigned = await this.writeEach([...this.stagedUnassigns()], (connectorId) =>
      this.rotationSdk.unassignTarget(this.organizationId, connectorId, targetSystemId),
    );
    const assigned = await this.writeEach([...this.stagedAssigns()], (connectorId) =>
      this.rotationSdk.assignTarget(this.organizationId, connectorId, targetSystemId),
    );

    // What failed stays staged, as the picks still differ from what the re-read target holds.
    return unassigned.failure ?? assigned.failure;
  }

  /** Collects refusals rather than stopping at the first. */
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
   * Only read once {@link loadSystem} has resolved. The connector picker ignores it and follows the
   * method alone.
   */
  protected readonly isActive = computed(
    () => this.existing()?.status === TargetSystemStatus.Active,
  );

  /**
   * Asks before a save leaves an automatic target with no access connector at all, since its
   * managed credentials stop rotating. The count is left out when it could not be read.
   */
  private async confirmRemovingLastConnector(): Promise<boolean> {
    const leavesNone =
      this.isAutomatic() &&
      this.assignedConnectors().length > 0 &&
      this.chosenConnectors().length === 0;
    if (!leavesNone) {
      return true;
    }
    const count = this.managedCredentialCount();
    const contentKey =
      count == null || count === 0
        ? "pamTargetSystemRemoveLastConnectorContentNone"
        : count === 1
          ? "pamTargetSystemRemoveLastConnectorContentOne"
          : "pamTargetSystemRemoveLastConnectorContent";
    return await this.dialogService.openSimpleDialog({
      title: { key: "pamTargetSystemRemoveLastConnectorTitle" },
      content: {
        key: contentKey,
        placeholders: count != null && count > 1 ? [String(count)] : [],
      },
      acceptButtonText: { key: "pamTargetSystemRemoveLastConnectorConfirm" },
      cancelButtonText: { key: "cancel" },
      type: "warning",
    });
  }

  protected readonly isDisabled = computed(
    () => this.existing()?.status === TargetSystemStatus.Disabled,
  );

  /** A target still being set up has no confirmed capability to toggle, as on the table. */
  protected readonly canToggleActivation = computed(() => this.isActive() || this.isDisabled());

  protected readonly deactivate = async (): Promise<void> => {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "pamTargetSystemDeactivateTitle" },
      content: { key: "pamTargetSystemDeactivateContent" },
      acceptButtonText: { key: "pamTargetSystemDeactivateConfirm" },
      cancelButtonText: { key: "cancel" },
      type: "warning",
    });
    if (!confirmed) {
      return;
    }
    await this.setEnabled(false);
  };

  protected readonly activate = (): Promise<void> => this.setEnabled(true);

  /** The server answers with no content, so the status is patched locally once it confirms. */
  private async setEnabled(enabled: boolean): Promise<void> {
    const system = this.existing();
    if (system == null) {
      return;
    }
    try {
      if (enabled) {
        await this.rotationSdk.enableTargetSystem(this.organizationId, system.id);
      } else {
        await this.rotationSdk.disableTargetSystem(this.organizationId, system.id);
      }
    } catch (e) {
      this.showError(e);
      return;
    }
    this.existing.set({
      ...system,
      status: enabled ? TargetSystemStatus.Active : TargetSystemStatus.Disabled,
    } as TargetSystemView);
    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t(
        enabled ? "pamTargetSystemActivateSuccess" : "pamTargetSystemDeactivateSuccess",
      ),
    });
  }

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
            : this.isActive()
              ? "pamTargetSystemDeleteContentDeactivateInstead"
              : "pamTargetSystemDeleteContent",
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
    const forms = [
      this.editing ? this.nameForm : this.createForm,
      this.policyForm,
      this.connectorsControl,
    ];
    // Harmless to include unconditionally; it's pristine except while finishing a kindless target.
    return this.showEditKindPicker() ? [...forms, this.editKindControl] : forms;
  }

  private markLiveFormsPristine(): void {
    this.liveForms().forEach((form) => form.markAsPristine());
    this.dirty.set(false);
  }

  /** Whether any input differs from what was loaded, which is what shows the save footer. */
  protected readonly dirty = signal(false);

  /** Puts every input back to the saved state, which is what Cancel does on the detail page. */
  protected readonly discardEdits = (): void => {
    const system = this.existing();
    if (system != null) {
      this.applySystem(system);
    }
    this.seedConnectorSelection();
    this.markLiveFormsPristine();
  };

  private readonly footerTemplate = viewChild<TemplateRef<unknown>>("footer");
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly layoutFooter = inject(LayoutFooterService);
  private readonly footerPortal = signal<TemplatePortal | null>(null);

  /** Whether the pinned Save and Cancel bar shows, which is only once an edit is unsaved. */
  protected readonly showFooter = computed(() => this.editing && this.dirty());

  ngOnDestroy(): void {
    this.detachFooter();
  }

  private detachFooter(): void {
    const portal = this.footerPortal();
    if (portal != null) {
      this.layoutFooter.detach(portal);
      this.footerPortal.set(null);
    }
  }

  unsavedChanges(): boolean {
    return this.liveForms().some((form) => form.dirty);
  }

  /** Leaves through the route's guard, which asks before discarding. */
  protected readonly cancel = async (): Promise<void> => {
    if (this.returnsToCredential && !this.editing) {
      this.markLiveFormsPristine();
      await this.router.navigate(this.addCredentialRoute);
      return;
    }
    await this.router.navigate([".."], { relativeTo: this.route });
  };

  private navigateToList(): Promise<boolean> {
    this.markLiveFormsPristine();
    return this.router.navigate([".."], { relativeTo: this.route });
  }

  private showError(e: unknown): void {
    const outcome = classifyRotationError(e);
    if (outcome.kind === "i18n") {
      this.toastService.showToast({ variant: "error", message: this.i18nService.t(outcome.key) });
      return;
    }
    const serverMessage =
      outcome.kind === "message"
        ? outcome.message
        : e instanceof ErrorResponse
          ? e.message
          : apiErrorBodyMessage(e instanceof Error ? e.message : "");
    this.toastService.showToast({
      variant: "error",
      message: serverMessage ?? this.i18nService.t("unexpectedError"),
    });
  }
}
