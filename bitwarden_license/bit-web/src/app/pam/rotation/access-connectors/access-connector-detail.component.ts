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
  BitCellComponent,
  ButtonModule,
  CardComponent,
  CheckboxModule,
  CopyClickDirective,
  DialogService,
  FormFieldModule,
  HeaderComponent,
  IconButtonModule,
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

const ACCESS_CONNECTOR_DETAIL_TABS = ["configuration", "history"] as const;

/** `null` for a saved assignment, otherwise the staged change not yet saved. */
export type AccessConnectorAssignmentPending = "add" | "remove" | null;

export type AccessConnectorAssignment = Omit<TargetSystemLabel, "id"> &
  AssignmentPickerRow & {
    readonly targetSystemId: TargetSystemId;
    readonly pending: AccessConnectorAssignmentPending;
  };

/**
 * Detail page for one access connector, a sibling of the rotation shell. It provides its own
 * {@link TargetSystemsService} and {@link OrgCiphersService}, since the shell's don't reach it.
 */
@Component({
  templateUrl: "./access-connector-detail.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [TargetSystemsService, OrgCiphersService],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    AssignmentPickerComponent,
    AsyncActionsModule,
    BadgeModule,
    BitCellComponent,
    DetailBreadcrumbComponent,
    ButtonModule,
    CardComponent,
    CheckboxModule,
    CopyClickDirective,
    FormFieldModule,
    HeaderComponent,
    IconButtonModule,
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
export class AccessConnectorDetailComponent {
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
  private readonly accessConnectorId = asUuid<AccessConnectorId>(
    this.route.snapshot.params.accessConnectorId,
  );

  protected readonly loading = signal(true);

  /** Whether the placeholder is drawn, which trails {@link loading} by the skeleton delay. */
  protected readonly showSkeleton = showSkeletonWhile(this.loading);

  protected readonly loadingVisible = computed(() => this.loading() || this.showSkeleton());

  protected readonly loadError = signal<unknown | null>(null);
  protected readonly accessConnector = signal<AccessConnectorDetail | null>(null);

  /**
   * The staged connector, which the page renders and {@link submit} diffs against the saved one.
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

  private readonly automaticSystems = toSignal(this.targetSystemsService.automaticSystems$, {
    initialValue: [] as TargetSystem[],
  });

  protected readonly targetSystemsLoadError = toSignal(this.targetSystemsService.loadError$, {
    initialValue: null as unknown,
  });

  private readonly connector = computed(() => this.accessConnector()?.connector ?? null);

  /** The saved assignments, which the staged list is diffed against. */
  private readonly savedAssignmentIds = computed<readonly TargetSystemId[]>(
    () => this.connector()?.assignedTargetSystemIds ?? [],
  );

  /** Every target the table lists: what is saved, then what has been staged on top of it. */
  protected readonly assignments = computed<AccessConnectorAssignment[]>(() => {
    const systemById = this.systemById();
    const saved = this.savedAssignmentIds();
    const stagedIds = this.stagedAssignmentIds();
    const savedSet = new Set<string>(saved.map(String));
    const stagedSet = new Set<string>(stagedIds.map(String));

    const listed = [...saved, ...stagedIds.filter((id) => !savedSet.has(String(id)))];
    return listed.map((id) => {
      const label = targetSystemLabel(this.i18nService, id, systemById.get(id));
      const pending: AccessConnectorAssignmentPending = !savedSet.has(String(id))
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

  /** The automatic target systems the staged list does not hold, as picker rows. */
  protected readonly assignOptions = computed<SelectItemView[]>(() => {
    const staged = new Set<string>(this.stagedAssignmentIds().map(String));
    return this.automaticSystems()
      .filter((system) => !staged.has(String(system.id)))
      .map((system) => {
        const { qualified } = targetSystemLabel(this.i18nService, system.id, system);
        return { id: String(system.id), listName: qualified, labelName: qualified };
      });
  });

  /** True when the org has nothing eligible at all, rather than having assigned it all. */
  protected readonly noEligibleTargetSystems = computed(
    () => this.targetSystemsLoadError() == null && this.automaticSystems().length === 0,
  );

  protected readonly assignmentColumns: readonly AssignmentPickerColumn[] = [
    { headerKey: "pamAccessConnectorAssignTargetLabel" },
    { headerKey: "pamTargetSystemTypeColumn" },
    { headerKey: "pamTargetSystemIdLabel" },
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
  protected readonly unassignTarget = async (
    assignment: AccessConnectorAssignment,
  ): Promise<boolean> => {
    const targetSystemId = assignment.targetSystemId;
    if (!this.stagedAssignmentIds().some((id) => id === targetSystemId)) {
      return false;
    }
    this.stageAssignments((ids) => ids.filter((id) => id !== targetSystemId));
    return true;
  };

  /**
   * Enables before writing assignments and disables after, since only an enabled connector can be
   * assigned.
   */
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

  protected readonly deleteAccessConnector = async (): Promise<void> => {
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
   * The server assigns only to an enabled connector, so unchecking Active drops staged additions.
   * Staged removals survive, since the server still honours them for an inactive connector.
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

  private async writeStatus(id: AccessConnectorId, active: boolean): Promise<void> {
    if (active) {
      await this.rotationSdk.enableConnector(this.organizationId, id);
    } else {
      await this.rotationSdk.disableConnector(this.organizationId, id);
    }
    this.patchStatus(active ? AccessConnectorStatus.Enabled : AccessConnectorStatus.Disabled);
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
        this.resetForm();
        if (accessConnector.jobs.length > 0) {
          void this.loadCredentialNames();
        }
      }
    } finally {
      this.loading.set(false);
    }
  }

  private resetForm(): void {
    this.formGroup.setValue({
      active: this.enabled(),
      assignedTargetSystemIds: [...this.savedAssignmentIds()],
    });
    this.formGroup.markAsPristine();
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
    this.formGroup.markAsPristine();
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

  private showError(e: unknown): void {
    const message =
      e instanceof ErrorResponse
        ? (e.message ?? this.i18nService.t("unexpectedError"))
        : this.i18nService.t("unexpectedError");
    this.toastService.showToast({ variant: "error", message });
  }
}

export const accessConnectorDetailDiscardGuard: CanDeactivateFn<AccessConnectorDetailComponent> = (
  component,
) => component.confirmDiscard();
