import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { filter, firstValueFrom, map } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { asUuid, uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  AsyncActionsModule,
  BadgeModule,
  BitCellComponent,
  BitCellDefDirective,
  BitCellLoadingDirective,
  BitColumnComponent,
  BitHeaderCellComponent,
  BitTableToolbarComponent,
  BitTableV2Component,
  ButtonModule,
  CopyClickDirective,
  DialogService,
  FILTER_CONTROL,
  FilterMenuModule,
  IconButtonModule,
  IconModule,
  LinkModule,
  MenuModule,
  SearchModule,
  SkeletonComponent,
  SkeletonTextComponent,
  TableDataSource,
  TableModule,
  ToastService,
  TooltipDirective,
  defineTable,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { AccessConnectorsService } from "../access-connectors/access-connectors.service";
import { assignableConnectors, eligibleConnectors } from "../assignable";
import { TARGET_SYSTEM_QUERY_PARAM } from "../create-flow";
import { filterOptions } from "../filter-options";
import {
  AccessConnector,
  AccessConnectorId,
  TargetSystemId,
  TargetSystemKind,
  TargetSystemMethod,
  TargetSystemStatus,
  TargetSystem,
} from "../rotation";
import { RotationLoadErrorComponent } from "../rotation-load-error.component";
import { RotationLoadingAnnouncerComponent } from "../rotation-loading-announcer.component";
import { RowBusyTracker } from "../row-busy-tracker";
import { showSkeletonWhile } from "../skeleton-delay";

import { AssignConnectorDialogComponent } from "./assign-connector-dialog.component";
import { targetSystemKindLabelKey, targetSystemMethodLabelKey } from "./target-system-label";
import {
  TargetSystemsEmptyStateComponent,
  TargetSystemTemplateKey,
} from "./target-systems-empty-state.component";
import { TargetSystemsService } from "./target-systems.service";

export type TargetSystemRow = {
  id: TargetSystemId;
  /** {@link id} as the string the copy control hands the clipboard. */
  idText: string;
  system: TargetSystem;
  name: string;
  /**
   * Null for a method this SDK can't model. The Method chip keys on this rather than
   * `system.method`, so an unlabelled method can't borrow another's label.
   */
  methodLabelKey: string | null;
  methodLabel: string | null;
  kindLabel: string | null;
  /** Two states only, so an unmodellable status reads as inactive. */
  statusLabelKey: "pamTargetSystemStatusActive" | "pamTargetSystemStatusInactive";
  statusLabel: string;
  active: boolean;
  /** Only an automatic-method target can claim a connector assignment. */
  canAssignConnectors: boolean;
  /** Only an active target can take a new managed credential. */
  canAddManagedCredential: boolean;
  /** The i18n key for why the menu can't assign an access connector now, or null when it can. */
  assignConnectorsBlockedKey: string | null;
};

@Component({
  templateUrl: "./target-systems-tab.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    AsyncActionsModule,
    BadgeModule,
    ButtonModule,
    CopyClickDirective,
    FilterMenuModule,
    IconButtonModule,
    IconModule,
    LinkModule,
    MenuModule,
    SearchModule,
    SkeletonComponent,
    SkeletonTextComponent,
    TableModule,
    BitTableToolbarComponent,
    BitTableV2Component,
    BitColumnComponent,
    BitHeaderCellComponent,
    BitCellComponent,
    BitCellDefDirective,
    BitCellLoadingDirective,
    TooltipDirective,
    RotationLoadErrorComponent,
    RotationLoadingAnnouncerComponent,
    TargetSystemsEmptyStateComponent,
    I18nPipe,
  ],
})
export class TargetSystemsTabComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly targetSystemsService = inject(TargetSystemsService);
  private readonly accessConnectorsService = inject(AccessConnectorsService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly configService = inject(ConfigService);

  // remove when VFO1 flag is removed
  protected readonly vfo1Enabled = toSignal(
    this.configService.getFeatureFlag$(FeatureFlag.VFO1Foundation),
    { initialValue: false },
  );

  private readonly organizationId = toSignal(
    this.route.params.pipe(map((p) => p.organizationId as OrganizationId)),
    { requireSync: true },
  );

  protected readonly loading = toSignal(this.targetSystemsService.loading$, { initialValue: true });
  protected readonly loadError = toSignal(this.targetSystemsService.loadError$, {
    initialValue: null,
  });

  /** Whether the placeholder is drawn, which trails {@link loading} by the skeleton delay. */
  protected readonly showSkeleton = showSkeletonWhile(this.loading);

  protected readonly loadingVisible = computed(() => this.loading() || this.showSkeleton());

  protected readonly skeletonRows = [0, 1, 2, 3, 4];

  private readonly systems = toSignal(this.targetSystemsService.systems$, {
    initialValue: [] as TargetSystem[],
  });
  private readonly accessConnectors = toSignal(this.accessConnectorsService.accessConnectors$, {
    initialValue: [] as AccessConnector[],
  });
  private readonly accessConnectorsLoading = toSignal(this.accessConnectorsService.loading$, {
    initialValue: true,
  });
  private readonly accessConnectorsLoadError = toSignal(this.accessConnectorsService.loadError$, {
    initialValue: null,
  });

  /** Whether the connector list has been read successfully. */
  private readonly connectorsKnown = computed(
    () => !this.accessConnectorsLoading() && this.accessConnectorsLoadError() == null,
  );

  /** Whether the connector read has landed and failed, so there is no list to offer. */
  private readonly connectorsUnavailable = computed(
    () => !this.accessConnectorsLoading() && this.accessConnectorsLoadError() != null,
  );

  private readonly rows = computed(() => this.buildRows(this.systems(), this.accessConnectors()));

  /**
   * Gates the toolbar's create button. A search term keeps the toolbar on screen over an empty
   * list, so the toolbar alone doesn't mean the org has target systems.
   */
  protected readonly hasSystems = computed(() => this.rows().length > 0);

  protected readonly dataSource = new TableDataSource<TargetSystemRow>();
  protected readonly table = defineTable<TargetSystemRow, "sessionTermination" | "actions">(
    this.rows,
  );
  /**
   * Model for the loading placeholder, with no rows, so rows from an earlier load don't show
   * through before the skeleton's delay.
   */
  protected readonly loadingTable = defineTable<TargetSystemRow, "sessionTermination" | "actions">(
    signal<TargetSystemRow[]>([]),
  );
  protected readonly searchControl = new FormControl("", { nonNullable: true });

  private readonly searchText = toSignal(this.searchControl.valueChanges, { initialValue: "" });

  private readonly methodFilterChip = viewChild("methodFilter", { read: FILTER_CONTROL });
  private readonly kindFilterChip = viewChild("kindFilter", { read: FILTER_CONTROL });
  private readonly statusFilterChip = viewChild("statusFilter", { read: FILTER_CONTROL });

  /** A method this SDK can't name adds no option, so this chip can be empty. */
  protected readonly methodOptions = computed(() =>
    filterOptions(
      this.rows().flatMap((row) =>
        row.methodLabelKey != null && row.methodLabel != null
          ? [[row.methodLabelKey, row.methodLabel] as const]
          : [],
      ),
    ),
  );

  protected readonly kindOptions = computed(() =>
    filterOptions(
      this.rows().flatMap((row) =>
        row.system.kind != null && row.kindLabel != null
          ? [[row.system.kind, row.kindLabel] as const]
          : [],
      ),
    ),
  );

  protected readonly statusOptions = computed(() =>
    filterOptions(this.rows().map((row) => [row.statusLabelKey, row.statusLabel] as const)),
  );

  protected readonly rowFilter = computed(() => {
    const filter = toTargetSystemFilter({
      search: this.searchText(),
      method: this.methodFilterChip()?.value(),
      kind: this.kindFilterChip()?.value(),
      status: this.statusFilterChip()?.value(),
    });
    return (row: TargetSystemRow): boolean => matchesFilter(row, filter);
  });

  /**
   * The v2 table's row test; inside the toolbar, chip and search values arrive as `values`. Read
   * the term from `values.search` alone, since {@link searchText} holds the same term.
   */
  protected readonly rowMatchesFilter = (
    row: TargetSystemRow,
    values: TargetSystemFilterValues,
  ): boolean => matchesFilter(row, toTargetSystemFilter(values));

  private readonly busyRows = new RowBusyTracker<TargetSystemId>();

  protected readonly isRowBusy = this.busyRows.isBusy;

  constructor() {
    effect(() => {
      void this.loadAll(this.organizationId());
    });

    effect(() => {
      this.dataSource.data = this.rows();
    });

    effect(() => {
      this.dataSource.filter = this.rowFilter();
    });
  }

  private async loadAll(organizationId: OrganizationId): Promise<void> {
    await Promise.all([
      this.targetSystemsService.load(organizationId),
      this.accessConnectorsService.load(organizationId),
    ]);
  }

  /** Whether the operator has asked for a retry. */
  protected readonly retried = signal(false);

  protected readonly retryLoad = (): Promise<void> => {
    this.retried.set(true);
    return this.loadAll(this.organizationId());
  };

  protected readonly openCreate = (): Promise<boolean> =>
    this.router.navigate(["..", "target-systems", "new"], { relativeTo: this.route });

  protected readonly openFromTemplate = (key: TargetSystemTemplateKey): Promise<boolean> =>
    this.router.navigate(["..", "target-systems", "new"], {
      relativeTo: this.route,
      queryParams: { template: key },
    });

  protected readonly openEdit = (system: TargetSystem): Promise<boolean> =>
    this.router.navigate(["..", "target-systems", system.id], { relativeTo: this.route });

  protected readonly openCreateManagedCredential = (system: TargetSystem): Promise<boolean> =>
    this.router.navigate(["..", "managed-credentials", "new"], {
      relativeTo: this.route,
      queryParams: { [TARGET_SYSTEM_QUERY_PARAM]: system.id },
    });

  /**
   * Waits for the connector read to settle, since the menu item is live while it is in flight; a
   * failed read toasts instead. The row stays busy throughout, so a delete can't race the
   * assignment's optimistic patch.
   */
  protected readonly openAssignConnectorDialog = (system: TargetSystem): Promise<void> =>
    this.busyRows.run(system.id, async () => {
      const stillMounted = await firstValueFrom(
        this.accessConnectorsService.loading$.pipe(
          filter((inFlight) => !inFlight),
          map(() => true),
          takeUntilDestroyed(this.destroyRef),
        ),
        { defaultValue: false },
      );
      if (!stillMounted) {
        return;
      }
      if (this.connectorsUnavailable()) {
        this.toastService.showToast({
          variant: "error",
          message: this.i18nService.t("pamTargetSystemConnectorAssignmentsLoadError"),
        });
        return;
      }

      const connectors = this.accessConnectors();
      const options = assignableConnectors(system.id, connectors);
      const noneEligible = eligibleConnectors(connectors).length === 0;

      const ref = AssignConnectorDialogComponent.open(this.dialogService, {
        data: { targetSystem: system, options, noneEligible },
      });
      const selectedId = await ref.closed.toPromise();
      if (!selectedId) {
        return;
      }
      const accessConnectorId = asUuid<AccessConnectorId>(selectedId);
      const accessConnector = this.accessConnectors().find((d) => d.id === accessConnectorId);
      if (!accessConnector) {
        return;
      }
      try {
        await this.accessConnectorsService.assign(accessConnector, system.id);
        this.toastService.showToast({
          variant: "success",
          message: this.i18nService.t("pamTargetSystemAssignConnectorSuccess"),
        });
      } catch (e) {
        this.showError(e);
      }
    });

  protected readonly disable = (system: TargetSystem): Promise<void> =>
    this.busyRows.run(system.id, async () => {
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
      try {
        await this.targetSystemsService.setEnabled(system, false);
        this.toastService.showToast({
          variant: "success",
          message: this.i18nService.t("pamTargetSystemDeactivateSuccess"),
        });
      } catch (e) {
        this.showError(e);
      }
    });

  protected readonly enable = (system: TargetSystem): Promise<void> =>
    this.busyRows.run(system.id, async () => {
      try {
        await this.targetSystemsService.setEnabled(system, true);
        this.toastService.showToast({
          variant: "success",
          message: this.i18nService.t("pamTargetSystemActivateSuccess"),
        });
      } catch (e) {
        this.showError(e);
      }
    });

  /**
   * Offered on every row; the server refuses while a rotation config names the target. The
   * confirmation also warns of dropped connector assignments, or suggests deactivating an active
   * target instead.
   */
  protected readonly confirmDelete = (system: TargetSystem): Promise<void> =>
    this.busyRows.run(system.id, async () => {
      const dropsAssignments =
        this.connectorsKnown() &&
        this.accessConnectors().some((connector) =>
          connector.assignedTargetSystemIds.includes(system.id),
        );
      const active = system.status === TargetSystemStatus.Active;
      const confirmed = await this.dialogService.openSimpleDialog({
        title: { key: "pamTargetSystemDeleteTitle" },
        content: {
          key: dropsAssignments
            ? "pamTargetSystemDeleteAssignedConnectorsContent"
            : active
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
        await this.targetSystemsService.delete(system);
        this.accessConnectorsService.forgetTargetSystem(system.id);
        this.toastService.showToast({
          variant: "success",
          message: this.i18nService.t("pamTargetSystemDeleteSuccess"),
        });
      } catch (e) {
        this.showError(e);
      }
    });

  private buildRows(systems: TargetSystem[], connectors: AccessConnector[]): TargetSystemRow[] {
    const connectorsKnown = this.connectorsKnown();
    const connectorsUnavailable = this.connectorsUnavailable();
    const hasActiveConnector = eligibleConnectors(connectors).length > 0;
    return systems.map((system) => {
      const methodLabelKey = targetSystemMethodLabelKey(system.method);
      const active = system.status === TargetSystemStatus.Active;
      const statusLabelKey = active
        ? ("pamTargetSystemStatusActive" as const)
        : ("pamTargetSystemStatusInactive" as const);
      return {
        id: system.id,
        idText: uuidAsString(system.id),
        system,
        name: system.name,
        methodLabelKey,
        methodLabel: methodLabelKey == null ? null : this.i18nService.t(methodLabelKey),
        kindLabel: system.kind != null ? this.kindLabel(system.kind) : null,
        statusLabelKey,
        statusLabel: this.i18nService.t(statusLabelKey),
        active,
        canAssignConnectors: system.method === TargetSystemMethod.Automatic,
        canAddManagedCredential: system.status === TargetSystemStatus.Active,
        assignConnectorsBlockedKey: connectorsUnavailable
          ? "pamTargetSystemConnectorAssignmentsLoadError"
          : !connectorsKnown || assignableConnectors(system.id, connectors).length > 0
            ? null
            : hasActiveConnector
              ? "pamTargetSystemAssignConnectorNoOptions"
              : "pamTargetSystemAssignConnectorNone",
      };
    });
  }

  /** Null for a kind with no label, such as one this SDK can't model. */
  private kindLabel(kind: TargetSystemKind): string | null {
    const key = targetSystemKindLabelKey(kind);
    return key == null ? null : this.i18nService.t(key);
  }

  private showError(e: unknown): void {
    const message =
      e instanceof ErrorResponse
        ? (e.message ?? this.i18nService.t("unexpectedError"))
        : this.i18nService.t("unexpectedError");
    this.toastService.showToast({ variant: "error", message });
  }
}

/** The toolbar's raw values by filter key, untyped because each host passes what a chip reports. */
type TargetSystemFilterValues = {
  search?: string;
  method?: unknown;
  kind?: unknown;
  status?: unknown;
};

type TargetSystemFilter = {
  text: string;
  methodLabelKey: string | null;
  kind: TargetSystemKind | null;
  statusLabelKey: string | null;
};

function toTargetSystemFilter(values: TargetSystemFilterValues): TargetSystemFilter {
  return {
    text: (values.search ?? "").trim().toLowerCase(),
    methodLabelKey: typeof values.method === "string" ? values.method : null,
    kind: typeof values.kind === "string" ? (values.kind as TargetSystemKind) : null,
    statusLabelKey: typeof values.status === "string" ? values.status : null,
  };
}

function matchesFilter(row: TargetSystemRow, filter: TargetSystemFilter): boolean {
  const { text, methodLabelKey, kind, statusLabelKey } = filter;
  if (
    text !== "" &&
    !row.name.toLowerCase().includes(text) &&
    !(row.kindLabel?.toLowerCase().includes(text) ?? false)
  ) {
    return false;
  }
  if (methodLabelKey != null && row.methodLabelKey !== methodLabelKey) {
    return false;
  }
  if (kind != null && row.system.kind !== kind) {
    return false;
  }
  if (statusLabelKey != null && row.statusLabelKey !== statusLabelKey) {
    return false;
  }
  return true;
}
