import { TemplatePortal } from "@angular/cdk/portal";
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  TemplateRef,
  ViewContainerRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { map } from "rxjs";

import {
  accessConnectorDeactivateConfirmOptions,
  accessConnectorDeleteConfirmOptions,
  TimestampPipe,
} from "@bitwarden/bit-pam-components";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { asUuid, uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  AsyncActionsModule,
  BadgeModule,
  BitCellComponent,
  BitCellDefDirective,
  BitColumnComponent,
  BitHeaderCellComponent,
  BitTableV2Component,
  ButtonModule,
  CalloutModule,
  CardComponent,
  CopyClickDirective,
  defineTable,
  DialogService,
  FormFieldModule,
  HeaderComponent,
  IconButtonModule,
  IconModule,
  LayoutFooterService,
  MenuModule,
  MultiSelectModule,
  SectionComponent,
  SectionHeaderComponent,
  SelectItemView,
  SkeletonComponent,
  SkeletonTextComponent,
  TabsModule,
  ToastService,
  TooltipDirective,
  TypographyModule,
} from "@bitwarden/components";
import type { CipherId } from "@bitwarden/sdk-internal";
import { I18nPipe } from "@bitwarden/ui-common";

import { HasUnsavedChangesDialog } from "../../unsaved-changes.guard";
import { DetailBreadcrumbComponent } from "../detail-breadcrumb.component";
import { tabFromSegment } from "../detail-tab";
import { RotationHistorySkeletonComponent } from "../managed-credentials/rotation-history-skeleton.component";
import { RotationHistoryComponent } from "../managed-credentials/rotation-history.component";
import { OrgCiphersService } from "../org-ciphers.service";
import {
  AccessConnector,
  AccessConnectorDetail,
  AccessConnectorId,
  AccessConnectorStatus,
  RotationConfigView,
  RotationConfigId,
  TargetSystemView,
  TargetSystemId,
} from "../rotation";
import { rotationErrorMessage } from "../rotation-error";
import { ROTATION_TABS, rotationLink } from "../rotation-links";
import { RotationLoadErrorComponent } from "../rotation-load-error.component";
import { RotationLoadingAnnouncerComponent } from "../rotation-loading-announcer.component";
import { lastSeenText, relativeTimeLabel } from "../rotation-relative-time";
import { RotationSdkService } from "../rotation-sdk.service";
import { targetSystemLabel } from "../target-systems/target-system-label";
import {
  TargetSystemStatusBadge,
  resolveTargetSystemStatus,
  targetSystemStatusBadge,
} from "../target-systems/target-system-status";
import { TargetSystemsService } from "../target-systems/target-systems.service";

import { accessConnectorDisplayStatus, accessConnectorStatusBadge } from "./access-connector-label";

const ACCESS_CONNECTOR_DETAIL_TABS = ["configuration", "history"] as const;

/** One row of the assigned target systems table, which lists the staged assignments. */
export type AccessConnectorAssignment = {
  readonly id: string;
  readonly targetSystemId: TargetSystemId;
  readonly idText: string;
  readonly name: string;
  /** The target system's name with its type, for the row's control labels. */
  readonly label: string;
  /** i18n key for the System type column, or null when there is none to state. */
  readonly typeKey: string | null;
  /** Null while the target system is unknown. */
  readonly statusBadge: TargetSystemStatusBadge | null;
};

/** Which notice tops the Configuration tab, if any. */
export type AccessConnectorCallout = "never-connected" | "disconnected" | null;

/**
 * Detail page for one access connector, a sibling of the rotation shell. It provides its own
 * {@link TargetSystemsService} and {@link OrgCiphersService}, since the shell's don't reach it.
 * Activate, Deactivate and Delete take effect at once; target system assignments are staged in
 * the picker and written by the pinned footer's Save.
 */
@Component({
  templateUrl: "./access-connector-detail.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [TargetSystemsService, OrgCiphersService],
  imports: [
    FormsModule,
    AsyncActionsModule,
    BadgeModule,
    BitCellComponent,
    BitCellDefDirective,
    BitColumnComponent,
    BitHeaderCellComponent,
    BitTableV2Component,
    ButtonModule,
    CalloutModule,
    CardComponent,
    CopyClickDirective,
    DetailBreadcrumbComponent,
    FormFieldModule,
    HeaderComponent,
    IconButtonModule,
    IconModule,
    MenuModule,
    MultiSelectModule,
    RotationHistoryComponent,
    RotationHistorySkeletonComponent,
    RotationLoadErrorComponent,
    RotationLoadingAnnouncerComponent,
    SectionComponent,
    SectionHeaderComponent,
    SkeletonComponent,
    SkeletonTextComponent,
    TabsModule,
    TooltipDirective,
    TypographyModule,
    I18nPipe,
    TimestampPipe,
  ],
})
export class AccessConnectorDetailComponent implements HasUnsavedChangesDialog {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly rotationSdk = inject(RotationSdkService);
  private readonly targetSystemsService = inject(TargetSystemsService);
  private readonly orgCiphers = inject(OrgCiphersService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly viewContainerRef = inject(ViewContainerRef);
  private readonly layoutFooter = inject(LayoutFooterService);

  private readonly organizationId = this.route.snapshot.params.organizationId as OrganizationId;
  private readonly accessConnectorId = asUuid<AccessConnectorId>(
    this.route.snapshot.params.accessConnectorId,
  );

  protected readonly loading = signal(true);

  protected readonly loadError = signal<unknown | null>(null);
  protected readonly accessConnector = signal<AccessConnectorDetail | null>(null);

  /** The assignments the picker holds, which {@link submit} diffs against the saved ones. */
  private readonly stagedAssignmentIds = signal<readonly TargetSystemId[]>([]);

  /** Holds the header's status actions while one is running. */
  protected readonly statusBusy = signal(false);

  /** Set by a failed Save, which the Configuration tab states until the next attempt. */
  protected readonly saveFailed = signal(false);

  protected readonly activeTab = toSignal(
    this.route.paramMap.pipe(
      map((params) => tabFromSegment(params.get("tab"), ACCESS_CONNECTOR_DETAIL_TABS)),
    ),
    {
      initialValue: tabFromSegment(
        this.route.snapshot.params.tab as string | undefined,
        ACCESS_CONNECTOR_DETAIL_TABS,
      ),
    },
  );

  /** Route to the Access connectors list, behind the breadcrumb and every exit. */
  protected readonly connectorsListRoute = rotationLink(
    this.organizationId,
    ROTATION_TABS.accessConnectors,
  );

  protected readonly configurationTabRoute = [
    ...this.connectorsListRoute,
    this.accessConnectorId,
    "configuration",
  ];
  protected readonly historyTabRoute = [
    ...this.connectorsListRoute,
    this.accessConnectorId,
    "history",
  ];

  private readonly systemById = toSignal(this.targetSystemsService.systemById$, {
    initialValue: new Map(),
  });

  /** The org's rotation configs, loaded only when there is job history to label. */
  private readonly rotationConfigs = signal<RotationConfigView[]>([]);

  /**
   * Every access connector in the org, for the target systems' Not connected status. `null` while
   * unread or failed, which never reads as Not connected.
   */
  private readonly orgConnectors = signal<readonly AccessConnector[] | null>(null);

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

  private readonly automaticSystems = toSignal(this.targetSystemsService.automaticSystems$, {
    initialValue: [] as TargetSystemView[],
  });

  protected readonly targetSystemsLoadError = toSignal(this.targetSystemsService.loadError$, {
    initialValue: null as unknown,
  });

  private readonly connector = computed(() => this.accessConnector()?.connector ?? null);

  /** `null` when the design shows no wording for the span, so the template shows the date. */
  protected readonly lastSeenAtMs = computed(() => {
    const heartbeat = this.connector()?.lastHeartbeatAt;
    const ms = heartbeat ? Date.parse(heartbeat) : NaN;
    return Number.isNaN(ms) ? null : ms;
  });

  protected readonly lastSeenLabel = computed(() => {
    const ms = this.lastSeenAtMs();
    return ms == null ? null : relativeTimeLabel(this.i18nService, lastSeenText(ms, Date.now()));
  });

  /** The saved assignments, which the staged list is diffed against. */
  private readonly savedAssignmentIds = computed<readonly TargetSystemId[]>(
    () => this.connector()?.assignedTargetSystemIds ?? [],
  );

  protected readonly titleText = computed(() => this.connector()?.name ?? "");

  protected readonly enabled = computed(
    () => this.connector()?.status === AccessConnectorStatus.Enabled,
  );

  /** The header badge: Inactive, else Connected or Disconnected. */
  protected readonly statusBadge = computed(() => {
    const connector = this.connector();
    return connector == null
      ? null
      : accessConnectorStatusBadge(accessConnectorDisplayStatus(connector));
  });

  /** An active connector that isn't connected says why; one never seen still needs setting up. */
  protected readonly callout = computed<AccessConnectorCallout>(() => {
    const connector = this.connector();
    if (connector == null || !this.enabled() || connector.isConnected) {
      return null;
    }
    return this.lastSeenAtMs() == null ? "never-connected" : "disconnected";
  });

  /** The org's connectors with this one as saved here, so its own changes show at once. */
  private readonly connectorsForStatus = computed<readonly AccessConnector[] | null>(() => {
    const connectors = this.orgConnectors();
    const connector = this.connector();
    if (connectors == null || connector == null) {
      return connectors;
    }
    return [...connectors.filter((other) => other.id !== connector.id), connector];
  });

  /** Every target the picker holds, in the order it was staged. */
  protected readonly assignments = computed<AccessConnectorAssignment[]>(() => {
    const systemById = this.systemById();
    const connectors = this.connectorsForStatus();
    return this.stagedAssignmentIds().map((id) => {
      const system = systemById.get(id);
      const label = targetSystemLabel(this.i18nService, id, system);
      return {
        id: String(id),
        targetSystemId: id,
        idText: uuidAsString(id),
        name: label.name,
        label: label.qualified,
        typeKey: label.qualifierKey,
        statusBadge:
          system == null
            ? null
            : targetSystemStatusBadge(resolveTargetSystemStatus(system, connectors)),
      };
    });
  });

  protected readonly assignmentsTable = defineTable<AccessConnectorAssignment, "actions">(
    this.assignments,
  );

  /**
   * The picker's options: the automatic target systems, plus anything staged that isn't one, so
   * every chip has an option behind it. An inactive connector offers only what it holds, since
   * the server assigns only to an enabled one.
   */
  protected readonly selectOptions = computed<SelectItemView[]>(() => {
    const staged = this.stagedAssignmentIds();
    const stagedSet = new Set<string>(staged.map(String));
    const systemById = this.systemById();
    const offered = this.enabled()
      ? this.automaticSystems()
      : this.automaticSystems().filter((system) => stagedSet.has(String(system.id)));
    const offeredSet = new Set<string>(offered.map((system) => String(system.id)));
    const extra = staged.filter((id) => !offeredSet.has(String(id)));
    return [
      ...offered.map((system) => this.selectItem(system.id, system)),
      ...extra.map((id) => this.selectItem(id, systemById.get(id))),
    ];
  });

  /** The staged assignments as picker items, which the multi-select shows as chips. */
  protected readonly selectedItems = computed<SelectItemView[]>(() => {
    const byId = new Map(this.selectOptions().map((item) => [item.id, item]));
    return this.stagedAssignmentIds()
      .map((id) => byId.get(String(id)))
      .filter((item): item is SelectItemView => item != null);
  });

  /** The i18n key for the hint under the picker. */
  protected readonly pickerHintKey = computed(() => {
    if (this.targetSystemsLoadError() != null) {
      return "pamAccessConnectorTargetSystemsLoadError";
    }
    if (!this.enabled()) {
      return "pamAccessConnectorAssignTargetSystemsDisabled";
    }
    return "pamAccessConnectorTargetSystemsHint";
  });

  /** True when the staged assignments differ from the saved ones. */
  protected readonly hasUnsavedChanges = computed(() => {
    const saved = new Set<string>(this.savedAssignmentIds().map(String));
    const staged = this.stagedAssignmentIds();
    return staged.length !== saved.size || staged.some((id) => !saved.has(String(id)));
  });

  protected readonly showFooter = computed(
    () =>
      !this.loading() &&
      this.loadError() == null &&
      this.activeTab() === "configuration" &&
      this.hasUnsavedChanges(),
  );

  private readonly footerTemplate = viewChild<TemplateRef<unknown>>("footer");

  constructor() {
    this.pinFooter();
    void this.initialize();
  }

  /** Mirrors the picker's selection into the staged list; nothing is written until Save. */
  protected onSelectionChanged(items: SelectItemView[] | null): void {
    const selected = new Set((items ?? []).map((item) => item.id));
    const kept = this.stagedAssignmentIds().filter((id) => selected.has(String(id)));
    const keptSet = new Set<string>(kept.map(String));
    const added = (items ?? [])
      .filter((item) => !keptSet.has(item.id))
      .map((item) => asUuid<TargetSystemId>(item.id));
    this.stagedAssignmentIds.set([...kept, ...added]);
  }

  /** Stages one target's removal. */
  protected unassignTarget(assignment: AccessConnectorAssignment): void {
    this.stagedAssignmentIds.update((ids) => ids.filter((id) => id !== assignment.targetSystemId));
  }

  protected discardEdits(): void {
    this.saveFailed.set(false);
    this.stagedAssignmentIds.set([...this.savedAssignmentIds()]);
  }

  /** Writes the staged assignments, then returns to the list. */
  protected readonly submit = async (): Promise<void> => {
    const connector = this.connector();
    if (connector == null) {
      return;
    }

    const saved = this.savedAssignmentIds();
    const staged = this.stagedAssignmentIds();
    const toAssign = staged.filter((id) => !saved.includes(id));
    const toUnassign = saved.filter((id) => !staged.includes(id));

    this.saveFailed.set(false);
    try {
      await this.writeAssignments(connector.id, toAssign, toUnassign);
    } catch (e) {
      this.saveFailed.set(true);
      this.showError(e, "pamAccessConnectorSaveFailed");
      return;
    }

    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("pamAccessConnectorSaved"),
    });
    await this.navigateToList();
  };

  protected readonly activate = async (): Promise<void> => {
    const connector = this.connector();
    if (connector == null || this.statusBusy()) {
      return;
    }
    this.statusBusy.set(true);
    try {
      await this.rotationSdk.enableConnector(this.organizationId, connector.id);
      this.patchStatus(AccessConnectorStatus.Enabled);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamAccessConnectorActivated"),
      });
    } catch (e) {
      this.showError(e, "unexpectedError");
    } finally {
      this.statusBusy.set(false);
    }
  };

  /** Bound to a menu item, so it confirms and reports its own failure. */
  protected async deactivate(): Promise<void> {
    const connector = this.connector();
    if (connector == null || this.statusBusy()) {
      return;
    }
    if (!(await this.dialogService.openSimpleDialog(accessConnectorDeactivateConfirmOptions()))) {
      return;
    }
    this.statusBusy.set(true);
    try {
      await this.rotationSdk.disableConnector(this.organizationId, connector.id);
      this.patchStatus(AccessConnectorStatus.Disabled);
      this.dropStagedAssignmentAdditions();
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamAccessConnectorDeactivated"),
      });
    } catch (e) {
      this.showError(e, "pamAccessConnectorDeactivateFailed");
    } finally {
      this.statusBusy.set(false);
    }
  }

  /** Bound to a menu item, so it confirms and reports its own failure. */
  protected async deleteAccessConnector(): Promise<void> {
    const connector = this.connector();
    if (connector == null || this.statusBusy()) {
      return;
    }
    const confirmed = await this.dialogService.openSimpleDialog(
      accessConnectorDeleteConfirmOptions(),
    );
    if (!confirmed) {
      return;
    }
    this.statusBusy.set(true);
    try {
      await this.rotationSdk.deleteConnector(this.organizationId, connector.id);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamAccessConnectorDeleted"),
      });
      this.discardEdits();
      await this.router.navigate(this.connectorsListRoute);
    } catch (e) {
      this.showError(e, "pamAccessConnectorDeleteFailed");
    } finally {
      this.statusBusy.set(false);
    }
  }

  /**
   * Read by the CanDeactivate guard, which a `:tab` change doesn't trigger. Nothing is unsaved
   * while loading, since nothing has been staged yet.
   */
  unsavedChanges(): boolean {
    return !this.loading() && this.hasUnsavedChanges();
  }

  private selectItem(id: TargetSystemId, system: TargetSystemView | undefined): SelectItemView {
    const { qualified } = targetSystemLabel(this.i18nService, id, system);
    return { id: String(id), listName: qualified, labelName: qualified };
  }

  /**
   * Pins Save and Cancel to the layout's footer region, outside the scrolling content, while an
   * assignment change is unsaved.
   */
  private pinFooter(): void {
    let portal: TemplatePortal | null = null;
    const detach = () => {
      if (portal != null) {
        this.layoutFooter.detach(portal);
        portal = null;
      }
    };
    effect(() => {
      const template = this.footerTemplate();
      if (template == null || !this.showFooter()) {
        detach();
      } else if (portal == null) {
        portal = new TemplatePortal(template, this.viewContainerRef);
        this.layoutFooter.attach(portal);
      }
    });
    inject(DestroyRef).onDestroy(detach);
  }

  /**
   * The server assigns only to an enabled connector, so deactivating drops staged additions.
   * Staged removals survive, since the server still honours them for an inactive connector.
   */
  private dropStagedAssignmentAdditions(): void {
    const saved = new Set<string>(this.savedAssignmentIds().map(String));
    this.stagedAssignmentIds.update((ids) => ids.filter((id) => saved.has(String(id))));
  }

  /** One call at a time; a refusal stops the rest and leaves earlier writes saved. */
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
      const [accessConnector] = await Promise.all([
        this.loadAccessConnector(),
        // Load target systems so assignment IDs resolve to names.
        this.targetSystemsService.load(this.organizationId),
      ]);
      if (accessConnector != null) {
        this.accessConnector.set(accessConnector);
        this.stagedAssignmentIds.set([...this.savedAssignmentIds()]);
        void this.loadOrgConnectors();
        if (accessConnector.jobs.length > 0) {
          void this.loadCredentialNames();
        }
      }
    } finally {
      this.loading.set(false);
    }
  }

  /** Not awaited; a failure only costs the target systems their Not connected status. */
  private async loadOrgConnectors(): Promise<void> {
    try {
      this.orgConnectors.set(await this.rotationSdk.listConnectors(this.organizationId));
    } catch {
      this.orgConnectors.set(null);
    }
  }

  /**
   * Not awaited, so first paint doesn't wait on decrypting every org cipher. A failure only costs
   * the Credential column its names; it falls back to the rotation config id.
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

  /** Records a failure, so the page needn't guess from a null. */
  private async loadAccessConnector(): Promise<AccessConnectorDetail | null> {
    try {
      return await this.rotationSdk.getConnector(this.organizationId, this.accessConnectorId);
    } catch (e) {
      this.loadError.set(e);
      return null;
    }
  }

  private navigateToList(): Promise<boolean> {
    return this.router.navigate(this.connectorsListRoute);
  }

  private patchStatus(status: AccessConnectorStatus): void {
    const accessConnector = this.accessConnector();
    if (accessConnector == null) {
      return;
    }
    this.accessConnector.set({
      ...accessConnector,
      connector: { ...accessConnector.connector, status },
    });
  }

  private patchAssignments(update: (ids: TargetSystemId[]) => TargetSystemId[]): void {
    const accessConnector = this.accessConnector();
    if (accessConnector == null) {
      return;
    }
    this.accessConnector.set({
      ...accessConnector,
      connector: {
        ...accessConnector.connector,
        assignedTargetSystemIds: update(accessConnector.connector.assignedTargetSystemIds),
      },
    });
  }

  /** The SDK's or server's reason when there is one, else the action's own failure copy. */
  private showError(e: unknown, fallbackKey: string): void {
    const message =
      rotationErrorMessage(e) ??
      (e instanceof ErrorResponse ? e.message : undefined) ??
      this.i18nService.t(fallbackKey);
    this.toastService.showToast({ variant: "error", message });
  }
}
