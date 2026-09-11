import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, computed, inject, signal } from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute, CanDeactivateFn, Router } from "@angular/router";
import { map } from "rxjs";

import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { asUuid } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  AsyncActionsModule,
  BadgeModule,
  ButtonModule,
  CardComponent,
  CheckboxModule,
  DialogService,
  FormFieldModule,
  HeaderComponent,
  SectionComponent,
  SectionHeaderComponent,
  SelectItemView,
  SkeletonComponent,
  SkeletonTextComponent,
  TableModule,
  TabsModule,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import type { CipherId } from "@bitwarden/sdk-internal";
import { I18nPipe } from "@bitwarden/ui-common";

import {
  accessConnectorDeactivateConfirmOptions,
  accessConnectorDeleteConfirmOptions,
} from "../../helpers/access-connector-confirm";
import { discardEditsConfirmOptions } from "../../helpers/discard-confirm";
import {
  AssignmentPickerColumn,
  AssignmentPickerComponent,
  AssignmentPickerHints,
  AssignmentPickerRow,
} from "../assignment-picker/assignment-picker.component";
import { DetailBreadcrumbComponent } from "../detail-breadcrumb.component";
import { tabFromSegment } from "../detail-tab";
import { RotationHistorySkeletonComponent } from "../managed-credentials/rotation-history-skeleton.component";
import { RotationHistoryComponent } from "../managed-credentials/rotation-history.component";
import { OrgCiphersService } from "../org-ciphers.service";
import {
  AccessConnectorDetail,
  AccessConnectorId,
  AccessConnectorStatus,
  RotationConfig,
  RotationConfigId,
  TargetSystem,
  TargetSystemId,
} from "../rotation";
import { ROTATION_TABS, rotationLink } from "../rotation-links";
import { RotationLoadErrorComponent } from "../rotation-load-error.component";
import { RotationLoadingAnnouncerComponent } from "../rotation-loading-announcer.component";
import { RotationSdkService } from "../rotation-sdk.service";
import { showSkeletonWhile } from "../skeleton-delay";
import { TargetSystemLabel, targetSystemLabel } from "../target-systems/target-system-label";
import { TargetSystemsService } from "../target-systems/target-systems.service";

/**
 * The detail page's two tabs, each with a URL of its own; Configuration is the default.
 */
const DAEMON_DETAIL_TABS = ["configuration", "history"] as const;

/**
 * Whether a listed assignment is saved, or only staged for a save that has not happened yet.
 */
export type DaemonAssignmentPending = "add" | "remove" | null;

/**
 * An assigned target system, named for the row that lists it.
 */
export type DaemonAssignment = Omit<TargetSystemLabel, "id"> &
  AssignmentPickerRow & {
    readonly targetSystemId: TargetSystemId;
    readonly pending: DaemonAssignmentPending;
  };

/**
 * Routed detail page for a single rotation daemon — a sibling of the rotation shell, matching
 * the target-system / rotation-config detail pages. Reached from the daemons tab.
 *
 * Shows status, connection, assigned target systems (via a page-scoped
 * {@link TargetSystemsService}), and recent rotation activity via the shared
 * {@link RotationHistoryComponent}.
 */
@Component({
  templateUrl: "./daemon-detail.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [TargetSystemsService, OrgCiphersService],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    AssignmentPickerComponent,
    AsyncActionsModule,
    BadgeModule,
    DetailBreadcrumbComponent,
    ButtonModule,
    CardComponent,
    CheckboxModule,
    FormFieldModule,
    HeaderComponent,
    RotationHistoryComponent,
    RotationHistorySkeletonComponent,
    RotationLoadErrorComponent,
    RotationLoadingAnnouncerComponent,
    SectionComponent,
    SectionHeaderComponent,
    SkeletonComponent,
    SkeletonTextComponent,
    TableModule,
    TabsModule,
    TypographyModule,
    I18nPipe,
  ],
})
export class DaemonDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly rotationSdk = inject(RotationSdkService);
  private readonly targetSystemsService = inject(TargetSystemsService);
  private readonly orgCiphers = inject(OrgCiphersService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly formBuilder = inject(FormBuilder);

  private readonly organizationId = this.route.snapshot.params.organizationId as OrganizationId;
  private readonly daemonId = asUuid<AccessConnectorId>(this.route.snapshot.params.daemonId);

  protected readonly loading = signal(true);

  /** Whether the placeholder is drawn, which trails {@link loading} by the skeleton delay. */
  protected readonly showSkeleton = showSkeletonWhile(this.loading);

  /** Whether the loading branch is on screen. */
  protected readonly loadingVisible = computed(() => this.loading() || this.showSkeleton());

  /** The error from the last read of the connector, or null when it succeeded. */
  protected readonly loadError = signal<unknown | null>(null);
  protected readonly daemon = signal<AccessConnectorDetail | null>(null);

  /**
   * The connector as the operator has asked for it, which is what the page renders and what
   * {@link submit} diffs against the loaded connector.
   */
  protected readonly formGroup = this.formBuilder.nonNullable.group({
    active: false,
    assignedTargetSystemIds: [[] as TargetSystemId[]],
  });

  private readonly staged = toSignal(
    this.formGroup.valueChanges.pipe(map(() => this.formGroup.getRawValue())),
    { initialValue: this.formGroup.getRawValue() },
  );

  protected readonly stagedActive = computed(() => this.staged().active);

  private readonly stagedAssignmentIds = computed(() => this.staged().assignedTargetSystemIds);

  /** The tab the URL names. */
  protected readonly activeTab = toSignal(
    this.route.paramMap.pipe(
      map((params) => tabFromSegment(params.get("tab"), DAEMON_DETAIL_TABS)),
    ),
    {
      initialValue: tabFromSegment(
        this.route.snapshot.params.tab as string | undefined,
        DAEMON_DETAIL_TABS,
      ),
    },
  );

  /** Route to the Target systems tab, offered when the org has nothing eligible to assign. */
  protected readonly targetSystemsRoute = rotationLink(
    this.organizationId,
    ROTATION_TABS.targetSystems,
  );

  /** Route to the Access connectors list, behind the breadcrumb and every exit. */
  protected readonly connectorsListRoute = rotationLink(
    this.organizationId,
    ROTATION_TABS.accessConnectors,
  );

  protected readonly configurationTabRoute = [
    ...this.connectorsListRoute,
    this.daemonId,
    "configuration",
  ];
  protected readonly historyTabRoute = [...this.connectorsListRoute, this.daemonId, "history"];

  private readonly systemById = toSignal(this.targetSystemsService.systemById$, {
    initialValue: new Map(),
  });

  /** The org's rotation configs, loaded only when there is job history to label. */
  private readonly rotationConfigs = signal<RotationConfig[]>([]);

  private readonly cipherNameById = toSignal(this.orgCiphers.cipherNameById$, {
    initialValue: new Map<CipherId, string>(),
  });

  /** Managed-credential names by rotation config id, for the history table's Credential column. */
  protected readonly credentialNames = computed<ReadonlyMap<RotationConfigId, string>>(() => {
    const names = this.cipherNameById();
    const resolved = new Map<RotationConfigId, string>();
    for (const config of this.rotationConfigs()) {
      const name = names.get(config.cipherId);
      if (name != null) {
        resolved.set(config.id, name);
      }
    }
    return resolved;
  });

  private readonly activeAutomaticSystems = toSignal(
    this.targetSystemsService.activeAutomaticSystems$,
    { initialValue: [] as TargetSystem[] },
  );

  protected readonly targetSystemsLoadError = toSignal(this.targetSystemsService.loadError$, {
    initialValue: null as unknown,
  });

  /** The connector itself; the detail's other half is its recent job history. */
  private readonly connector = computed(() => this.daemon()?.connector ?? null);

  /** The assignments as last read from the server, which the staged list is diffed against. */
  private readonly savedAssignmentIds = computed<readonly TargetSystemId[]>(
    () => this.connector()?.assignedTargetSystemIds ?? [],
  );

  /** Every target the table lists: what is saved, then what has been staged on top of it. */
  protected readonly assignments = computed<DaemonAssignment[]>(() => {
    const systemById = this.systemById();
    const saved = this.savedAssignmentIds();
    const stagedIds = this.stagedAssignmentIds();
    const savedSet = new Set<string>(saved.map(String));
    const stagedSet = new Set<string>(stagedIds.map(String));

    const listed = [...saved, ...stagedIds.filter((id) => !savedSet.has(String(id)))];
    return listed.map((id) => {
      const label = targetSystemLabel(this.i18nService, id, systemById.get(id));
      const pending: DaemonAssignmentPending = !savedSet.has(String(id))
        ? "add"
        : !stagedSet.has(String(id))
          ? "remove"
          : null;
      return {
        ...label,
        id: String(id),
        targetSystemId: id,
        label: label.qualified,
        pending,
      };
    });
  });

  protected readonly titleText = computed(() => this.connector()?.name ?? "");

  /** The saved status, which the header badge states; the checkbox states the staged one. */
  protected readonly enabled = computed(
    () => this.connector()?.status === AccessConnectorStatus.Enabled,
  );

  /** The active automatic target systems the staged list does not already hold, as picker rows. */
  protected readonly assignOptions = computed<SelectItemView[]>(() => {
    const staged = new Set<string>(this.stagedAssignmentIds().map(String));
    return this.activeAutomaticSystems()
      .filter((system) => !staged.has(String(system.id)))
      .map((system) => {
        const { qualified } = targetSystemLabel(this.i18nService, system.id, system);
        return { id: String(system.id), listName: qualified, labelName: qualified };
      });
  });

  /** True when the org has nothing eligible at all, as opposed to having assigned it all already. */
  protected readonly noEligibleTargetSystems = computed(
    () => this.targetSystemsLoadError() == null && this.activeAutomaticSystems().length === 0,
  );

  protected readonly assignmentColumns: readonly AssignmentPickerColumn[] = [
    { headerKey: "pamAccessConnectorAssignTargetLabel" },
    { headerKey: "pamTargetSystemKindColumn" },
  ];

  protected readonly assignmentHints: AssignmentPickerHints = {
    default: "pamAccessConnectorAssignSelectHint",
    noneEligible: "pamAccessConnectorAssignNoTargetSystems",
    loadError: "pamAccessConnectorTargetSystemsLoadError",
    disabled: "pamAccessConnectorAssignTargetDisabled",
  };

  constructor() {
    this.formGroup.controls.active.valueChanges.pipe(takeUntilDestroyed()).subscribe((active) => {
      if (!active) {
        this.dropStagedAssignmentAdditions();
      }
    });
    void this.initialize();
  }

  /** Stage every picked target; nothing is written until Save. */
  protected readonly assignTargets = async (
    selected: SelectItemView[],
  ): Promise<readonly string[]> => {
    if (!this.stagedActive() || selected.length === 0) {
      return [];
    }

    const staged = new Set<string>(this.stagedAssignmentIds().map(String));
    const added = selected
      .filter((item) => !staged.has(item.id))
      .map((item) => asUuid<TargetSystemId>(item.id));
    this.stageAssignments((ids) => [...ids, ...added]);
    return selected.map((item) => item.id);
  };

  /** Stage one target's removal. */
  protected readonly unassignTarget = async (assignment: DaemonAssignment): Promise<boolean> => {
    const targetSystemId = assignment.targetSystemId;
    if (!this.stagedAssignmentIds().some((id) => id === targetSystemId)) {
      return false;
    }
    this.stageAssignments((ids) => ids.filter((id) => id !== targetSystemId));
    return true;
  };

  /** Write the staged connector: the status change, then the assignments it gained and lost. */
  protected readonly submit = async (): Promise<void> => {
    const connector = this.connector();
    if (connector == null) {
      return;
    }

    const active = this.stagedActive();
    const statusChange = active === this.enabled() ? null : active;
    if (statusChange === false && !(await this.confirmDeactivate(connector.name))) {
      return;
    }

    const saved = this.savedAssignmentIds();
    const staged = this.stagedAssignmentIds();
    const toAssign = staged.filter((id) => !saved.includes(id));
    const toUnassign = saved.filter((id) => !staged.includes(id));

    try {
      if (statusChange === true) {
        await this.writeStatus(connector.id, true);
      }
      await this.writeAssignments(connector.id, toAssign, toUnassign);
      if (statusChange === false) {
        await this.writeStatus(connector.id, false);
      }
    } catch (e) {
      this.showError(e);
      return;
    }

    this.formGroup.markAsPristine();
    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("pamAccessConnectorSaved"),
    });
  };

  /** Delete the daemon permanently after confirming, then return to the list. */
  protected readonly deleteDaemon = async (): Promise<void> => {
    const connector = this.connector();
    if (connector == null) {
      return;
    }
    const confirmed = await this.dialogService.openSimpleDialog(
      accessConnectorDeleteConfirmOptions(connector.name),
    );
    if (!confirmed) {
      return;
    }
    try {
      await this.rotationSdk.deleteConnector(this.organizationId, connector.id);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamAccessConnectorDeleted"),
      });
      await this.navigateToList();
    } catch (e) {
      this.showError(e);
    }
  };

  /** Confirm before staged edits are thrown away. */
  async confirmDiscard(): Promise<boolean> {
    if (!this.formGroup.dirty) {
      return true;
    }

    return await this.dialogService.openSimpleDialog(discardEditsConfirmOptions());
  }

  private confirmDeactivate(name: string): Promise<boolean> {
    return this.dialogService.openSimpleDialog(accessConnectorDeactivateConfirmOptions(name));
  }

  /**
   * Drop the assignments staged on top of the saved list.
   *
   * The server takes `assignTarget` only while the connector is enabled, so a staged addition
   * cannot outlive the Active checkbox that {@link assignTargets} required to stage it. Staged
   * removals survive: taking an assignment away from a connector that is on its way to inactive
   * is a request the server still honours.
   */
  private dropStagedAssignmentAdditions(): void {
    const saved = new Set<string>(this.savedAssignmentIds().map(String));
    if (this.stagedAssignmentIds().every((id) => saved.has(String(id)))) {
      return;
    }
    this.stageAssignments((ids) => ids.filter((id) => saved.has(String(id))));
  }

  private stageAssignments(update: (ids: TargetSystemId[]) => TargetSystemId[]): void {
    const control = this.formGroup.controls.assignedTargetSystemIds;
    control.setValue(update(control.value));
    control.markAsDirty();
  }

  /** Applies one status change, patching the local copy once the server has taken it. */
  private async writeStatus(id: AccessConnectorId, active: boolean): Promise<void> {
    if (active) {
      await this.rotationSdk.enableConnector(this.organizationId, id);
    } else {
      await this.rotationSdk.disableConnector(this.organizationId, id);
    }
    this.patchStatus(active ? AccessConnectorStatus.Enabled : AccessConnectorStatus.Disabled);
  }

  /** Applies the assignment diff one call at a time, stopping at the first refusal. */
  private async writeAssignments(
    id: AccessConnectorId,
    toAssign: readonly TargetSystemId[],
    toUnassign: readonly TargetSystemId[],
  ): Promise<void> {
    for (const targetSystemId of toAssign) {
      await this.rotationSdk.assignTarget(this.organizationId, id, targetSystemId);
      this.patchAssignments((ids) => [...ids, targetSystemId]);
    }
    for (const targetSystemId of toUnassign) {
      await this.rotationSdk.unassignTarget(this.organizationId, id, targetSystemId);
      this.patchAssignments((ids) => ids.filter((existing) => existing !== targetSystemId));
    }
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
      const [daemon] = await Promise.all([
        this.loadDaemon(),
        // Load target systems so assignment IDs resolve to names.
        this.targetSystemsService.load(this.organizationId),
      ]);
      if (daemon != null) {
        this.daemon.set(daemon);
        this.resetForm();
        if (daemon.jobs.length > 0) {
          void this.loadCredentialNames();
        }
      }
    } finally {
      this.loading.set(false);
    }
  }

  /** Seed the form from the loaded connector. */
  private resetForm(): void {
    this.formGroup.setValue({
      active: this.enabled(),
      assignedTargetSystemIds: [...this.savedAssignmentIds()],
    });
    this.formGroup.markAsPristine();
  }

  /**
   * Resolve the names of the managed credentials this connector's jobs rotated.
   *
   * Only worth the org-wide config and cipher reads when there is history to label, and a failure
   * costs the History tab its Credential names rather than the page: the table falls back to the
   * rotation config id, which still tells an operator which credential to look up.
   *
   * Left to settle on its own rather than awaited, for the same reason: the names land in a signal
   * the Credential column reads, and the column already renders without them, so the Configuration
   * tab does not spend its first paint waiting on a decrypt of every cipher in the organization.
   */
  private async loadCredentialNames(): Promise<void> {
    try {
      const [configs] = await Promise.all([
        this.rotationSdk.listConfigs(this.organizationId),
        this.orgCiphers.load(this.organizationId),
      ]);
      this.rotationConfigs.set(configs ?? []);
    } catch {
      this.rotationConfigs.set([]);
    }
  }

  /** Reads the connector, recording a failure rather than leaving the page to guess from a null. */
  private async loadDaemon(): Promise<AccessConnectorDetail | null> {
    try {
      return await this.rotationSdk.getConnector(this.organizationId, this.daemonId);
    } catch (e) {
      this.loadError.set(e);
      return null;
    }
  }

  private navigateToList(): Promise<boolean> {
    this.formGroup.markAsPristine();
    return this.router.navigate(this.connectorsListRoute);
  }

  /** Patch the loaded daemon's status locally (new reference for OnPush; jobs + fields carried over). */
  private patchStatus(status: AccessConnectorStatus): void {
    const daemon = this.daemon();
    if (daemon == null) {
      return;
    }
    this.daemon.set({ ...daemon, connector: { ...daemon.connector, status } });
  }

  /**
   * Patch the loaded daemon's assignments locally (new reference for OnPush; jobs + fields carried
   * over).
   */
  private patchAssignments(update: (ids: TargetSystemId[]) => TargetSystemId[]): void {
    const daemon = this.daemon();
    if (daemon == null) {
      return;
    }
    this.daemon.set({
      ...daemon,
      connector: {
        ...daemon.connector,
        assignedTargetSystemIds: update(daemon.connector.assignedTargetSystemIds),
      },
    });
  }

  private showError(e: unknown): void {
    const message =
      e instanceof ErrorResponse
        ? (e.message ?? this.i18nService.t("unexpectedError"))
        : this.i18nService.t("unexpectedError");
    this.toastService.showToast({ variant: "error", message });
  }
}

export const daemonDetailDiscardGuard: CanDeactivateFn<DaemonDetailComponent> = (component) =>
  component.confirmDiscard();
