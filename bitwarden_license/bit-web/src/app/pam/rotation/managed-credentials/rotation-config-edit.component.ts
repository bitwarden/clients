import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  LOCALE_ID,
  computed,
  inject,
  signal,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { firstValueFrom, map } from "rxjs";

import { CollectionAdminService } from "@bitwarden/admin-console/common";
import { CollectionAdminView } from "@bitwarden/common/admin-console/models/collections";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
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
  IconTileComponent,
  ItemModule,
  SectionComponent,
  SectionHeaderComponent,
  SelectModule,
  SkeletonComponent,
  SkeletonTextComponent,
  TabsModule,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import type { CipherId } from "@bitwarden/sdk-internal";
import { I18nPipe } from "@bitwarden/ui-common";

import { HasUnsavedChangesDialog } from "../../unsaved-changes.guard";
import {
  TARGET_SYSTEM_QUERY_PARAM,
  THEN_MANAGED_CREDENTIAL,
  THEN_QUERY_PARAM,
} from "../create-flow";
import { DetailBreadcrumbComponent } from "../detail-breadcrumb.component";
import { tabFromSegment } from "../detail-tab";
import {
  ManagedCredentialDraft,
  ManagedCredentialDraftService,
} from "../managed-credential-draft.service";
import { OrgCiphersService } from "../org-ciphers.service";
import {
  AccessConnector,
  AccessConnectorId,
  AccessConnectorStatus,
  RotationConfigCreateRequest,
  RotationConfigDetailView,
  RotationConfigId,
  RotationConfigView,
  TargetSystemId,
  TargetSystemKind,
  TargetSystemMethod,
  TargetSystemStatus,
  TargetSystemView,
} from "../rotation";
import {
  ConnectorState,
  assignedConnectors,
  connectorStateFor,
  isConnected,
  resolveDetailStatus,
} from "../rotation-detail-status";
import { classifyRotationError } from "../rotation-error";
import { ROTATION_TABS, rotationLink } from "../rotation-links";
import { RotationLoadErrorComponent } from "../rotation-load-error.component";
import { RotationLoadingAnnouncerComponent } from "../rotation-loading-announcer.component";
import { RotationScheduleInputComponent } from "../rotation-schedule-input/rotation-schedule-input.component";
import { RotationConfigDescription, RotationSdkService } from "../rotation-sdk.service";
import {
  formatRotationAge,
  formatRotationDate,
  formatRotationTimestamp,
} from "../rotation-timestamp";
import { showSkeletonWhile } from "../skeleton-delay";
import { AssignConnectorDialogComponent } from "../target-systems/assign-connector-dialog.component";
import { TargetSystemsService } from "../target-systems/target-systems.service";

import { RotationRowStatus } from "./rotation-config-row";
import { RotationHistorySkeletonComponent } from "./rotation-history-skeleton.component";
import { RotationHistoryComponent } from "./rotation-history.component";

const ACCOUNT_IDENTITY_MAX_LENGTH = 500;

const ROTATION_CONFIG_EDIT_TABS = ["configuration", "history"] as const;

export type RotationConfigEditTab = (typeof ROTATION_CONFIG_EDIT_TABS)[number];

/**
 * Create and edit page for a rotation config. It provides its own `OrgCiphersService` and
 * `TargetSystemsService`, since the shell route's providers don't reach a sibling page.
 */
@Component({
  templateUrl: "./rotation-config-edit.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [OrgCiphersService, TargetSystemsService],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    AsyncActionsModule,
    BadgeModule,
    DetailBreadcrumbComponent,
    FormFieldModule,
    ButtonModule,
    CalloutModule,
    CardComponent,
    CheckboxModule,
    HeaderComponent,
    IconTileComponent,
    ItemModule,
    RotationHistoryComponent,
    RotationHistorySkeletonComponent,
    RotationLoadErrorComponent,
    RotationLoadingAnnouncerComponent,
    RotationScheduleInputComponent,
    SectionComponent,
    SectionHeaderComponent,
    SelectModule,
    SkeletonComponent,
    SkeletonTextComponent,
    TabsModule,
    TypographyModule,
    I18nPipe,
  ],
})
export class RotationConfigEditComponent implements HasUnsavedChangesDialog {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(FormBuilder);
  private readonly rotationSdk = inject(RotationSdkService);
  private readonly targetSystemsService = inject(TargetSystemsService);
  private readonly orgCiphersService = inject(OrgCiphersService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly draftService = inject(ManagedCredentialDraftService);
  private readonly accountService = inject(AccountService);
  private readonly collectionAdminService = inject(CollectionAdminService);
  private readonly locale = inject(LOCALE_ID);

  private readonly organizationId = this.route.snapshot.params.organizationId as OrganizationId;
  private readonly configId: RotationConfigId | undefined =
    this.route.snapshot.params.configId == null
      ? undefined
      : asUuid<RotationConfigId>(this.route.snapshot.params.configId);

  /**
   * A target chosen before this page opened (`?targetSystemId=`), from the target-systems tab's
   * "Add managed credential" action or from the round trip through target-system creation.
   */
  private readonly preselectedTargetSystemId: string | undefined =
    this.route.snapshot.queryParams?.[TARGET_SYSTEM_QUERY_PARAM];

  protected readonly editing = this.configId != null;

  /** Route to the Managed credentials list, behind the breadcrumb, Cancel, and every exit. */
  protected readonly credentialsListRoute = rotationLink(
    this.organizationId,
    ROTATION_TABS.managedCredentials,
  );

  protected readonly configurationTabRoute = [
    ...this.credentialsListRoute,
    this.configId,
    "configuration",
  ];
  protected readonly historyTabRoute = [...this.credentialsListRoute, this.configId, "history"];

  protected readonly activeTab = toSignal(
    this.route.paramMap.pipe(
      map((params) => tabFromSegment(params.get("tab"), ROTATION_CONFIG_EDIT_TABS)),
    ),
    {
      initialValue: tabFromSegment(
        this.route.snapshot.params.tab as string | undefined,
        ROTATION_CONFIG_EDIT_TABS,
      ),
    },
  );

  protected readonly loading = signal(true);

  /** Whether the placeholder is drawn, which trails {@link loading} by the skeleton delay. */
  protected readonly showSkeleton = showSkeletonWhile(this.loading);

  protected readonly loadingVisible = computed(() => this.loading() || this.showSkeleton());

  protected readonly loadError = signal<unknown | null>(null);

  /** Four blocks, the rough depth of the card each of these pages opens with. */
  protected readonly skeletonFields = [0, 1, 2, 3];

  protected readonly existingConfig = signal<RotationConfigDetailView | null>(null);

  protected readonly config = computed(() => this.existingConfig()?.config ?? null);

  private readonly cipherNameById = toSignal(this.orgCiphersService.cipherNameById$, {
    initialValue: new Map<CipherId, string>(),
  });

  /** The vault item's name, or its id when the item isn't among the org's loaded ciphers. */
  protected readonly cipherName = computed(() => {
    const config = this.config();
    return config == null
      ? ""
      : (this.cipherNameById().get(config.cipherId) ?? String(config.cipherId));
  });

  /** `true` once loaded if the blob failed to verify — a config always has one, unlike a target. */
  protected readonly configSealUnverified = computed(
    () => this.config() != null && this.config()?.sealed == null,
  );

  protected readonly headerIcon = this.editing ? undefined : "bwi-plus";

  private readonly allCiphers = toSignal(this.orgCiphersService.ciphers$, {
    initialValue: [],
  });

  private readonly cipher = computed(() => {
    const cipherId = this.config()?.cipherId;
    return cipherId == null
      ? null
      : (this.allCiphers().find((c) => asUuid<CipherId>(c.id) === cipherId) ?? null);
  });

  /** Empty until the vault item resolves, so the page never titles itself with an id. */
  /** The org's name for the item when known, else the loaded item's; empty while unresolved. */
  protected readonly vaultItemName = computed(() => {
    const config = this.config();
    return config == null
      ? ""
      : (this.cipherNameById().get(config.cipherId) ?? this.cipher()?.name ?? "");
  });

  protected readonly titleText = computed(() =>
    this.editing ? this.vaultItemName() : this.i18nService.t("pamRotationConfigCreateTitle"),
  );

  private readonly allTargetSystems = toSignal(this.targetSystemsService.systems$, {
    initialValue: [],
  });

  /** The create picker offers only active targets; the server rejects an inactive one. */
  protected readonly activeTargetSystems = computed(() =>
    this.allTargetSystems().filter((s) => s.status === TargetSystemStatus.Active),
  );

  protected readonly hasActiveTargetSystems = computed(() => this.activeTargetSystems().length > 0);

  /** `null` when the connector read failed, so no target is described from a guess. */
  private readonly connectors = signal<AccessConnector[] | null>(null);

  protected readonly targetOptions = computed(() =>
    this.activeTargetSystems().map((system) => ({
      id: String(system.id),
      name: system.name,
      description: this.targetDescription(system),
    })),
  );

  private targetDescription(system: TargetSystemView): string | undefined {
    if (system.method === TargetSystemMethod.Manual) {
      return this.i18nService.t("pamRotationConfigTargetManual");
    }
    if (this.connectors() != null && !this.hasConnectedConnector(system)) {
      return this.i18nService.t("pamRotationConfigTargetNoConnector");
    }
    return undefined;
  }

  private hasConnectedConnector(system: TargetSystemView): boolean {
    const systemId = uuidAsString(system.id).toLowerCase();
    return (this.connectors() ?? []).some(
      (connector) =>
        connector.status === AccessConnectorStatus.Enabled &&
        connector.isConnected &&
        connector.assignedTargetSystemIds.some((id) => uuidAsString(id).toLowerCase() === systemId),
    );
  }

  private readonly editableCiphers = toSignal(this.orgCiphersService.editableCiphers$, {
    initialValue: [],
  });

  /** A cipher can have only one rotation config, so configured ones leave the create picker. */
  private readonly configuredCipherIds = signal<Set<CipherId>>(new Set());

  protected readonly availableCiphers = computed(() =>
    this.editableCiphers().filter((c) => !this.configuredCipherIds().has(asUuid<CipherId>(c.id))),
  );

  protected readonly createForm = this.formBuilder.nonNullable.group({
    cipherId: ["", [Validators.required]],
    targetSystemId: ["", [Validators.required]],
    accountIdentity: ["", [Validators.required, Validators.maxLength(ACCOUNT_IDENTITY_MAX_LENGTH)]],
    terminateSessions: [false],
    scheduleCron: [null as string | null],
    rotateOnAccessEnd: [false],
  });

  private readonly selectedTargetId = toSignal(
    this.createForm.controls.targetSystemId.valueChanges,
    { initialValue: "" },
  );

  private readonly selectedTarget = computed(
    () => this.activeTargetSystems().find((s) => String(s.id) === this.selectedTargetId()) ?? null,
  );

  protected readonly selectedTargetIsManual = computed(
    () => this.selectedTarget()?.method === TargetSystemMethod.Manual,
  );

  protected readonly selectedTargetNotConnected = computed(() => {
    const target = this.selectedTarget();
    return (
      target != null &&
      target.method === TargetSystemMethod.Automatic &&
      this.connectors() != null &&
      !this.hasConnectedConnector(target)
    );
  });

  protected readonly terminateSessionsReasonKey = computed(() => {
    if (this.selectedTargetIsManual()) {
      return "pamRotationConfigAutomaticOnly";
    }
    if (
      this.terminateAllowedFor(this.selectedTarget() ?? undefined) ||
      this.terminateSessionsUnknown()
    ) {
      return null;
    }
    return "pamRotationConfigEndSessionsAvailableOnce";
  });

  protected readonly settingsForm = this.formBuilder.nonNullable.group({
    scheduleCron: [null as string | null],
    rotateOnAccessEnd: [false],
  });

  protected readonly accountForm = this.formBuilder.nonNullable.group({
    accountIdentity: ["", [Validators.required, Validators.maxLength(ACCOUNT_IDENTITY_MAX_LENGTH)]],
    terminateSessions: [false],
  });

  /**
   * The two edit cards as one form, since the server takes schedule and account in one write.
   * While a job runs the account half is disabled and Save is off, since every update re-seals
   * the config and the server refuses that until the job ends.
   */
  protected readonly editForm = this.formBuilder.group({
    settings: this.settingsForm,
    account: this.accountForm,
  });

  private readonly description = signal<RotationConfigDescription | null>(null);

  private readonly collections = signal<CollectionAdminView[]>([]);

  protected readonly sharedFolderNames = computed(() => {
    const collectionIds = this.cipher()?.collectionIds ?? [];
    const nameById = new Map(this.collections().map((c) => [uuidAsString(c.id), c.name]));
    return collectionIds.flatMap((id) => {
      const name = nameById.get(id);
      return name == null ? [] : [name];
    });
  });

  protected readonly isManual = computed(
    () => this.config()?.targetSystemMethod === TargetSystemMethod.Manual,
  );

  private readonly configTargetSystem = computed(() => {
    const targetSystemId = this.config()?.targetSystemId;
    return this.allTargetSystems().find((s) => s.id === targetSystemId) ?? null;
  });

  private readonly connectorState = computed<ConnectorState>(() => {
    const config = this.config();
    return config == null ? "unknown" : connectorStateFor(this.connectors(), config.targetSystemId);
  });

  protected readonly connectorItems = computed(() => {
    const config = this.config();
    if (config == null || this.connectors() == null) {
      return [];
    }
    return assignedConnectors(this.connectors() ?? [], config.targetSystemId).map((connector) => ({
      id: String(connector.id),
      name: connector.name,
      connected: isConnected(connector),
    }));
  });

  protected readonly showConnectors = computed(() => !this.isManual() && this.connectors() != null);

  protected readonly connectorNames = computed(
    () => new Map((this.connectors() ?? []).map((c) => [String(c.id), c.name])),
  );

  protected readonly jobs = computed(() => this.existingConfig()?.jobs ?? []);

  protected readonly detailStatus = computed(() => {
    const config = this.config();
    return config == null ? null : resolveDetailStatus(config, this.jobs(), this.connectorState());
  });

  protected readonly callout = computed(() => this.detailStatus()?.callout ?? null);

  protected readonly canRotateNow = computed(() => {
    const config = this.config();
    return (
      config != null &&
      (this.description()?.actions.canRotateNow ?? false) &&
      config.enabled &&
      !config.hasActiveJob &&
      this.detailStatus()?.status !== RotationRowStatus.NotConnected
    );
  });

  protected readonly canPause = computed(() => this.description()?.actions.canPause ?? false);

  protected readonly canRecordManual = computed(
    () => this.description()?.actions.canRecordManual ?? false,
  );

  protected readonly endingSessions = computed(() => {
    const sealed = this.configTargetSystem()?.sealed;
    return this.isManual() || sealed == null
      ? null
      : { kind: sealed.kind, supported: sealed.supportsSessionTermination === true };
  });

  protected readonly usernameHintKey = computed(() => {
    if (this.isManual()) {
      return "pamRotationDetailUsernameHintManual";
    }
    switch (this.configTargetSystem()?.sealed?.kind) {
      case TargetSystemKind.Entra:
        return "pamRotationDetailUsernameHintEntra";
      case TargetSystemKind.CustomScript:
        return "pamRotationDetailUsernameHintCustomScript";
      default:
        return "pamRotationDetailUsernameHintDefault";
    }
  });

  protected readonly scheduleLabelKey = computed(() =>
    this.isManual() ? "pamRotationDetailDueSchedule" : "pamRotationConfigScheduleLabel",
  );

  protected readonly lastRotatedText = computed(() => {
    const at = this.config()?.lastRotationAt;
    return at == null ? this.i18nService.t("pamRotationConfigNeverRotated") : this.timestamp(at);
  });

  protected readonly nextRotationText = computed(() => {
    const config = this.config();
    if (config == null) {
      return "";
    }
    if (config.hasActiveJob) {
      return this.i18nService.t("pamRotationAttemptInProgress");
    }
    const at = config.nextRotationAt;
    if (!config.enabled || at == null) {
      return this.i18nService.t("pamRotationDetailNone");
    }
    return config.awaitingManualRotation
      ? this.i18nService.t("pamRotationDetailNextDue", formatRotationDate(at, this.locale))
      : this.timestamp(at);
  });

  protected readonly dueAgeText = computed(() => {
    const at = this.config()?.nextRotationAt;
    return at == null ? "" : formatRotationAge(at, Date.now(), this.locale);
  });

  protected readonly timedOutParts = computed(() => {
    const marker = "\u0000";
    const [before, after] = this.i18nService
      .t("pamRotationDetailCalloutTimedOut", marker)
      .split(marker);
    return { before, after: after ?? "" };
  });

  private timestamp(iso: string): string {
    return formatRotationTimestamp(iso, this.locale);
  }

  constructor() {
    this.coupleTargetControls();
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
        await this.initializeEditMode();
      } else {
        await this.initializeCreateMode();
      }
    } catch (e) {
      this.loadError.set(e);
    } finally {
      this.loading.set(false);
      this.markLoadedState();
    }
  }

  private async initializeCreateMode(): Promise<void> {
    const [configs, connectors] = await Promise.all([
      this.rotationSdk.listConfigs(this.organizationId),
      this.loadConnectors(),
      this.targetSystemsService.load(this.organizationId),
      this.orgCiphersService.load(this.organizationId),
    ]);
    await this.throwIfTargetSystemsFailed();
    this.configuredCipherIds.set(new Set(configs.map((c) => c.cipherId)));
    this.connectors.set(connectors);
    this.restoreDraft();
    this.applyPreselectedTargetSystem();
  }

  private async loadConnectors(): Promise<AccessConnector[] | null> {
    try {
      return (await this.rotationSdk.listConnectors(this.organizationId)) ?? [];
    } catch {
      return null;
    }
  }

  /** What the form held before the admin left to add a target system, read once. */
  private restoreDraft(): void {
    const draft = this.takenDraft() ?? this.draftService.take(this.organizationId);
    if (draft == null) {
      return;
    }
    this.takenDraft.set(draft);
    this.emptyFormValue.set(JSON.stringify(this.createForm.getRawValue()));
    this.createForm.patchValue({
      cipherId: draft.cipherId,
      targetSystemId: draft.targetSystemId,
      accountIdentity: draft.accountIdentity,
      scheduleCron: draft.scheduleCron,
      rotateOnAccessEnd: draft.rotateOnAccessEnd,
      terminateSessions: draft.terminateSessions,
    });
    this.applyTargetCoupling();
  }

  private readonly takenDraft = signal<ManagedCredentialDraft | null>(null);

  /** The form as it stood before a draft filled it, which a restored draft is measured against. */
  private readonly emptyFormValue = signal<string | null>(null);

  /**
   * `TargetSystemsService.load` resolves even on failure, so this checks `loadError$` to tell a
   * failed read from an org with no targets.
   */
  private async throwIfTargetSystemsFailed(): Promise<void> {
    const error = await firstValueFrom(this.targetSystemsService.loadError$);
    if (error != null) {
      throw error;
    }
  }

  /** Selects {@link preselectedTargetSystemId} only if the picker offers it. */
  private applyPreselectedTargetSystem(): void {
    const preselected = this.preselectedTargetSystemId;
    if (
      preselected == null ||
      !this.activeTargetSystems().some((system) => String(system.id) === preselected)
    ) {
      return;
    }
    this.createForm.patchValue({ targetSystemId: preselected });
    this.applyTargetCoupling();
  }

  private async initializeEditMode(): Promise<void> {
    const [detail, connectors] = await Promise.all([
      this.rotationSdk.getConfig(this.organizationId, this.configId!),
      this.loadConnectors(),
      this.targetSystemsService.load(this.organizationId),
      this.orgCiphersService.load(this.organizationId),
      this.loadCollections(),
    ]);
    this.connectors.set(connectors);
    await this.applyDetail(detail);
    this.settingsForm.patchValue({
      scheduleCron: detail.config.scheduleCron,
      rotateOnAccessEnd: detail.config.rotateOnAccessEnd,
    });
    const sealed = detail.config.sealed;
    if (sealed == null) {
      return;
    }
    this.accountForm.patchValue({
      accountIdentity: sealed.accountIdentity,
      terminateSessions: sealed.terminateSessions,
    });
  }

  private async loadCollections(): Promise<void> {
    try {
      const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
      this.collections.set(
        await firstValueFrom(
          this.collectionAdminService.collectionAdminViews$(this.organizationId, userId),
        ),
      );
    } catch {
      this.collections.set([]);
    }
  }

  private async applyDetail(detail: RotationConfigDetailView): Promise<void> {
    const statuses = new Map(this.allTargetSystems().map((s) => [s.id, s.status]));
    const descriptions = await this.rotationSdk.describeConfigs([detail.config], statuses);
    this.description.set(descriptions.get(detail.config.id) ?? null);
    this.existingConfig.set(detail);
    this.applyEditLocks(detail.config);
  }

  /** Re-reads the config after an action, leaving what the operator has typed alone. */
  private async reloadConfig(): Promise<void> {
    await this.applyDetail(await this.rotationSdk.getConfig(this.organizationId, this.configId!));
  }

  private applyEditLocks(config: RotationConfigView): void {
    const { accountIdentity, terminateSessions } = this.accountForm.controls;
    const { rotateOnAccessEnd } = this.settingsForm.controls;
    const manual = config.targetSystemMethod === TargetSystemMethod.Manual;

    if (config.hasActiveJob) {
      accountIdentity.disable({ emitEvent: false });
    } else {
      accountIdentity.enable({ emitEvent: false });
    }

    const canTerminate =
      !manual &&
      !config.hasActiveJob &&
      this.configTargetSystem()?.sealed?.supportsSessionTermination === true;
    if (canTerminate) {
      terminateSessions.enable({ emitEvent: false });
    } else {
      terminateSessions.disable({ emitEvent: false });
    }

    if (manual) {
      rotateOnAccessEnd.disable({ emitEvent: false });
    } else {
      rotateOnAccessEnd.enable({ emitEvent: false });
    }
  }

  /** True for an automatic target with no verified sealed fields — the checkbox is disabled for "unknown", not "unsupported". */
  protected readonly terminateSessionsUnknown = computed(() => {
    const target = this.selectedTarget();
    return (
      target != null && target.method === TargetSystemMethod.Automatic && target.sealed == null
    );
  });

  /**
   * The server rejects `terminateSessions` unless the target is automatic and confirms it, and a
   * manual target has no access-end rotation to raise.
   */
  private coupleTargetControls(): void {
    this.createForm.controls.targetSystemId.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.applyTargetCoupling());
  }

  private applyTargetCoupling(): void {
    const terminateControl = this.createForm.controls.terminateSessions;
    const accessEndControl = this.createForm.controls.rotateOnAccessEnd;
    const targetId = this.createForm.controls.targetSystemId.value;
    const target = this.activeTargetSystems().find((s) => String(s.id) === targetId);

    if (this.terminateAllowedFor(target)) {
      terminateControl.enable({ emitEvent: false });
    } else {
      terminateControl.setValue(false, { emitEvent: false });
      terminateControl.disable({ emitEvent: false });
    }

    if (target?.method === TargetSystemMethod.Manual) {
      accessEndControl.setValue(false, { emitEvent: false });
      accessEndControl.disable({ emitEvent: false });
    } else {
      accessEndControl.enable({ emitEvent: false });
    }
  }

  private terminateAllowedFor(target: TargetSystemView | undefined): boolean {
    return (
      target != null &&
      target.method === TargetSystemMethod.Automatic &&
      target.sealed?.supportsSessionTermination === true
    );
  }

  protected readonly submitCreate = async (): Promise<void> => {
    this.createForm.markAllAsTouched();
    if (this.createForm.invalid) {
      return;
    }
    const value = this.createForm.getRawValue();
    const request: RotationConfigCreateRequest = {
      cipherId: asUuid<CipherId>(value.cipherId),
      targetSystemId: asUuid<TargetSystemId>(value.targetSystemId),
      accountIdentity: value.accountIdentity,
      terminateSessions: value.terminateSessions,
      scheduleCron: value.scheduleCron ?? undefined,
      rotateOnAccessEnd: value.rotateOnAccessEnd,
    };
    try {
      await this.rotationSdk.createConfig(this.organizationId, request);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamRotationConfigAdded"),
      });
      await this.navigateBack();
    } catch (e) {
      this.showError(e);
    }
  };

  /**
   * Replaces the blob wholesale, so `cipherId`/`targetSystemId` are resent exactly as loaded
   * though neither is editable here. Also rejected while a job is in flight.
   */
  protected readonly submitEdit = async (): Promise<void> => {
    this.settingsForm.markAllAsTouched();
    this.accountForm.markAllAsTouched();
    if (this.settingsForm.invalid || this.accountForm.invalid) {
      return;
    }
    const existing = this.config();
    if (existing == null) {
      return;
    }
    const settings = this.settingsForm.getRawValue();
    const account = this.accountForm.getRawValue();
    const request: RotationConfigCreateRequest = {
      cipherId: existing.cipherId,
      targetSystemId: existing.targetSystemId,
      accountIdentity: account.accountIdentity,
      terminateSessions: account.terminateSessions,
      scheduleCron: settings.scheduleCron ?? undefined,
      rotateOnAccessEnd: settings.rotateOnAccessEnd,
    };
    try {
      await this.rotationSdk.updateConfig(this.organizationId, this.configId!, request);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamRotationConfigSaved"),
      });
      await this.navigateBack();
    } catch (e) {
      this.showError(e);
    }
  };

  /** Seam for the Pause rotation confirmation, which resolves true until its dialog is designed. */
  protected readonly openPauseDialog = (): Promise<boolean> => Promise.resolve(true);

  /** Seam for the Rotate now confirmation shown when End active sessions is on. */
  protected readonly openRotateNowDialog = (): Promise<boolean> => Promise.resolve(true);

  private async runAction(action: () => Promise<void>, successKey: string): Promise<void> {
    try {
      await action();
      this.toastService.showToast({ variant: "success", message: this.i18nService.t(successKey) });
      await this.reloadConfig();
    } catch (e) {
      this.showError(e);
    }
  }

  protected readonly pause = async (): Promise<void> => {
    if (!(await this.openPauseDialog())) {
      return;
    }
    const wasRotating = this.config()?.hasActiveJob ?? false;
    await this.runAction(
      () => this.rotationSdk.pauseConfig(this.organizationId, this.configId!),
      wasRotating ? "pamRotationConfigPauseWhileRotatingSuccess" : "pamRotationConfigPauseSuccess",
    );
  };

  protected readonly resume = (): Promise<void> =>
    this.runAction(
      () => this.rotationSdk.resumeConfig(this.organizationId, this.configId!),
      "pamRotationConfigResumeSuccess",
    );

  protected readonly rotateNow = async (): Promise<void> => {
    const needsConfirm = this.accountForm.controls.terminateSessions.value;
    if (needsConfirm && !(await this.openRotateNowDialog())) {
      return;
    }
    await this.runAction(
      () => this.rotationSdk.rotateNow(this.organizationId, this.configId!),
      "pamRotationConfigRotateNowStarted",
    );
  };

  protected readonly markRotated = async (): Promise<void> => {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "pamRotationConfigMarkRotatedTitle" },
      content: { key: "pamRotationConfigMarkRotatedContent" },
      acceptButtonText: { key: "pamRotationConfigMarkRotated" },
      cancelButtonText: { key: "cancel" },
      type: "info",
    });
    if (!confirmed) {
      return;
    }
    await this.runAction(
      () => this.rotationSdk.recordManualRotation(this.organizationId, this.configId!),
      "pamRotationConfigMarkedRotated",
    );
  };

  protected readonly assignConnector = async (): Promise<void> => {
    const config = this.config();
    const targetSystem = this.configTargetSystem();
    const connectors = this.connectors();
    if (config == null || targetSystem == null || connectors == null) {
      return;
    }
    const enabled = connectors.filter((c) => c.status === AccessConnectorStatus.Enabled);
    const dialog = AssignConnectorDialogComponent.open(this.dialogService, {
      data: {
        targetSystem,
        options: enabled.filter((c) => !c.assignedTargetSystemIds.includes(config.targetSystemId)),
        noneEligible: enabled.length === 0,
      },
    });
    const connectorId = await firstValueFrom(dialog.closed);
    if (connectorId == null) {
      return;
    }
    try {
      await this.rotationSdk.assignTarget(
        this.organizationId,
        asUuid<AccessConnectorId>(connectorId),
        config.targetSystemId,
      );
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamTargetSystemAssignConnectorSuccess"),
      });
      this.connectors.set(await this.loadConnectors());
    } catch (e) {
      this.showError(e);
    }
  };

  protected readonly viewConnectors = (): Promise<boolean> =>
    this.router.navigate(rotationLink(this.organizationId, ROTATION_TABS.accessConnectors), {
      queryParams: { targetSystemId: this.config()?.targetSystemId },
    });

  /**
   * Removes rotation management; the cipher stays in the vault. Blocked while a job is in flight,
   * which the server also rejects.
   */
  protected readonly removeRotation = async (): Promise<void> => {
    const config = this.config();
    if (config == null || config.hasActiveJob) {
      return;
    }
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "pamRotationConfigDeleteConfirmTitle" },
      content: { key: "pamRotationConfigDeleteConfirmContent" },
      acceptButtonText: { key: "remove" },
      cancelButtonText: { key: "cancel" },
      type: "warning",
    });
    if (!confirmed) {
      return;
    }
    try {
      await this.rotationSdk.deleteConfig(this.organizationId, this.configId!);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamRotationConfigDeleteSuccess"),
      });
      await this.navigateBack();
    } catch (e) {
      this.showError(e);
    }
  };

  /** The target-system create page returns here with the new target selected. */
  protected readonly createTargetSystem = (): Promise<boolean> => {
    const value = this.createForm.getRawValue();
    this.draftService.save({ organizationId: this.organizationId, ...value });
    this.markSaved();
    return this.router.navigate(["target-systems", "new"], {
      relativeTo: this.route.parent,
      queryParams: { [THEN_QUERY_PARAM]: THEN_MANAGED_CREDENTIAL },
    });
  };

  private liveForm(): AbstractControl {
    return this.editing ? this.editForm : this.createForm;
  }

  /** The live form's value as the admin was last shown it, serialized. */
  private readonly savedValue = signal("");

  /** A restored draft stays unsaved, so leaving still asks before it is lost. */
  private markLoadedState(): void {
    const empty = this.emptyFormValue();
    if (empty == null) {
      this.markSaved();
      return;
    }
    this.savedValue.set(empty);
  }

  private markSaved(): void {
    this.savedValue.set(JSON.stringify(this.liveForm().getRawValue()));
  }

  /**
   * Read by the CanDeactivate guard, which a `:tab` change doesn't trigger. Nothing is unsaved
   * while loading, since `savedValue` has no snapshot until `initialize()` settles.
   */
  unsavedChanges(): boolean {
    return !this.loading() && JSON.stringify(this.liveForm().getRawValue()) !== this.savedValue();
  }

  /** Leaves through the route's guard, which asks before discarding. */
  protected readonly cancel = async (): Promise<void> => {
    await this.router.navigate(this.credentialsListRoute);
  };

  private navigateBack(): Promise<boolean> {
    this.markSaved();
    return this.router.navigate(this.credentialsListRoute);
  }

  private showError(e: unknown): void {
    const outcome = classifyRotationError(e);
    if (outcome.kind === "i18n") {
      this.toastService.showToast({ variant: "error", message: this.i18nService.t(outcome.key) });
      return;
    }
    const message =
      outcome.kind === "message"
        ? outcome.message
        : e instanceof ErrorResponse
          ? e.message
          : undefined;
    this.toastService.showToast({
      variant: "error",
      message: message ?? this.i18nService.t("unexpectedError"),
    });
  }
}
