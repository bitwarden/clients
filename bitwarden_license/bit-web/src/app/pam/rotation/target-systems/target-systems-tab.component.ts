import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { filter, firstValueFrom, map } from "rxjs";

import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
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
  FilterMenuModule,
  IconButtonModule,
  IconModule,
  LinkModule,
  MenuModule,
  SearchModule,
  SkeletonComponent,
  SkeletonTextComponent,
  ToastService,
  TooltipDirective,
  defineTable,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { AccessConnectorsService } from "../access-connectors/access-connectors.service";
import { assignableConnectors, eligibleConnectors } from "../assignable";
import { TARGET_SYSTEM_QUERY_PARAM } from "../create-flow";
import { filterOptions } from "../filter-options";
import { RotationConfigsService } from "../managed-credentials/rotation-configs.service";
import {
  AccessConnector,
  AccessConnectorId,
  RotationConfigView,
  TargetSystemId,
  TargetSystemKind,
  TargetSystemMethod,
  TargetSystemStatus,
  TargetSystemView,
} from "../rotation";
import { RotationLoadErrorComponent } from "../rotation-load-error.component";
import { RotationLoadingAnnouncerComponent } from "../rotation-loading-announcer.component";
import { RowBusyTracker } from "../row-busy-tracker";
import { showSkeletonWhile } from "../skeleton-delay";

import { AssignConnectorDialogComponent } from "./assign-connector-dialog.component";
import { targetSystemKindLabelKey, targetSystemMethodLabelKey } from "./target-system-label";
import {
  TARGET_SYSTEM_STATUS_BADGES,
  TargetSystemRowStatus,
  TargetSystemStatusBadge,
  resolveTargetSystemStatus,
  targetSystemStatusBadge,
} from "./target-system-status";
import {
  TargetSystemsEmptyStateComponent,
  TargetSystemTemplateKey,
} from "./target-systems-empty-state.component";
import { TargetSystemsService } from "./target-systems.service";

export type TargetSystemRow = {
  id: TargetSystemId;
  /** {@link id} as the string the copy control hands the clipboard. */
  idText: string;
  system: TargetSystemView;
  name: string;
  /** Null for a method this SDK can't model, so it can't borrow another method's label. */
  methodLabel: string | null;
  /** `system.sealed?.kind`, null for a manual target or one with no verified sealed fields. */
  kind: TargetSystemKind | null;
  kindLabel: string | null;
  status: TargetSystemRowStatus;
  statusBadge: TargetSystemStatusBadge;
  /** The Status column's sort key. */
  statusSortOrder: number;
  active: boolean;
  /**
   * The managed credentials naming this target, or null while that list is unread or failed to
   * load, which is distinct from none.
   */
  managedCredentialCount: number | null;
  /** The ids of the access connectors that hold this target, for the Access connector chip. */
  connectorIds: string[];
  /**
   * True when `sealed` is absent on a row that isn't `pendingSeal`: the blob exists but failed to
   * verify. Surfaced as an icon beside the name, since the status column can't show it.
   */
  integrityCheckFailed: boolean;
  /** Only an automatic-method target can claim a connector assignment. */
  canAssignConnectors: boolean;
  /** Only an active target can take a new managed credential. */
  canAddManagedCredential: boolean;
  /** The i18n key for why the menu can't assign an access connector now, or null when it can. */
  assignConnectorsBlockedKey: string | null;
  /**
   * The i18n key for why Activate/Deactivate are disabled, or null when either is live. A
   * `pendingSeal` target has no confirmed capability to toggle until setup finishes.
   */
  activationBlockedKey: string | null;
  /** The drill-down link's query, which scopes the Managed credentials tab to this target. */
  managedCredentialsQueryParams: Record<string, string>;
  /** True while a managed credential names this target, which the server refuses to delete. */
  deleteBlocked: boolean;
};

const FILTERABLE_KINDS: readonly TargetSystemKind[] = [
  TargetSystemKind.Entra,
  TargetSystemKind.CustomScript,
];

@Component({
  templateUrl: "./target-systems-tab.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
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
    RouterLink,
    SearchModule,
    SkeletonComponent,
    SkeletonTextComponent,
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
  private readonly rotationConfigsService = inject(RotationConfigsService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);

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
    initialValue: [] as TargetSystemView[],
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

  private readonly configs = toSignal(this.rotationConfigsService.configs$, {
    initialValue: [] as RotationConfigView[],
  });
  private readonly configsLoading = toSignal(this.rotationConfigsService.loading$, {
    initialValue: true,
  });
  private readonly configsLoadError = toSignal(this.rotationConfigsService.loadError$, {
    initialValue: null,
  });

  /** The managed credentials per target system, or null while the list is unread or failed. */
  private readonly credentialCounts = computed<ReadonlyMap<TargetSystemId, number> | null>(() => {
    if (this.configsLoading() || this.configsLoadError() != null) {
      return null;
    }
    const counts = new Map<TargetSystemId, number>();
    for (const config of this.configs()) {
      counts.set(config.targetSystemId, (counts.get(config.targetSystemId) ?? 0) + 1);
    }
    return counts;
  });

  private readonly rows = computed(() =>
    this.buildRows(this.systems(), this.accessConnectors(), this.credentialCounts()),
  );

  /**
   * Gates the table and the toolbar's create button. A search term keeps the table on screen
   * over an empty list, so the toolbar alone doesn't mean the org has target systems.
   */
  protected readonly hasSystems = computed(() => this.rows().length > 0);

  protected readonly table = defineTable<TargetSystemRow, "actions">(this.rows);
  /**
   * Model for the loading placeholder, with no rows, so rows from an earlier load don't show
   * through before the skeleton's delay.
   */
  protected readonly loadingTable = defineTable<TargetSystemRow, "actions">(
    signal<TargetSystemRow[]>([]),
  );
  protected readonly searchControl = new FormControl("", { nonNullable: true });

  protected readonly TargetSystemMethod = TargetSystemMethod;

  /**
   * Every system type the chip can name, whether or not a row holds it, so an empty one shows a
   * zero count.
   */
  protected readonly kindOptions = FILTERABLE_KINDS.flatMap((kind) => {
    const label = this.kindLabel(kind);
    return label == null ? [] : [{ value: kind, label }];
  });

  /** Every status a row can hold, named by the badge that shows it. */
  protected readonly statusOptions = computed(() =>
    TARGET_SYSTEM_STATUS_BADGES.filter(
      (badge) =>
        badge.status !== TargetSystemRowStatus.PendingSeal ||
        this.rows().some((row) => row.status === TargetSystemRowStatus.PendingSeal),
    ),
  );

  /** Every access connector in the org, so one holding no target still shows a zero count. */
  protected readonly connectorOptions = computed(() =>
    filterOptions(this.accessConnectors().map((c) => [String(c.id), c.name] as const)),
  );

  /** Orders by urgency, then the most managed credentials, then name. */
  protected readonly sortByStatus = (
    a: TargetSystemRow,
    b: TargetSystemRow,
    direction?: "asc" | "desc",
  ): number =>
    a.statusSortOrder - b.statusSortOrder ||
    (b.managedCredentialCount ?? 0) - (a.managedCredentialCount ?? 0) ||
    a.name.localeCompare(b.name) * (direction === "desc" ? -1 : 1);

  /** Orders by count, an unread one last, then by name. */
  protected readonly sortByManagedCredentials = (
    a: TargetSystemRow,
    b: TargetSystemRow,
    direction?: "asc" | "desc",
  ): number =>
    (a.managedCredentialCount ?? -1) - (b.managedCredentialCount ?? -1) ||
    a.name.localeCompare(b.name) * (direction === "desc" ? -1 : 1);

  /** The table's row test; the toolbar hands over the search and chip values as `values`. */
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

  protected readonly openEdit = (system: TargetSystemView): Promise<boolean> =>
    this.router.navigate(["..", "target-systems", system.id], { relativeTo: this.route });

  protected readonly openCreateManagedCredential = (system: TargetSystemView): Promise<boolean> =>
    this.router.navigate(["..", "managed-credentials", "new"], {
      relativeTo: this.route,
      queryParams: { [TARGET_SYSTEM_QUERY_PARAM]: system.id },
    });

  /**
   * Waits for the connector read to settle, since the menu item is live while it is in flight; a
   * failed read toasts instead. The row stays busy throughout, so a delete can't race the
   * assignment's optimistic patch.
   */
  protected readonly openAssignConnectorDialog = (system: TargetSystemView): Promise<void> =>
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

  protected readonly disable = (system: TargetSystemView): Promise<void> =>
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

  protected readonly enable = (system: TargetSystemView): Promise<void> =>
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
  protected readonly confirmDelete = (system: TargetSystemView): Promise<void> =>
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

  private buildRows(
    systems: TargetSystemView[],
    connectors: AccessConnector[],
    credentialCounts: ReadonlyMap<TargetSystemId, number> | null,
  ): TargetSystemRow[] {
    const connectorsKnown = this.connectorsKnown();
    const connectorsUnavailable = this.connectorsUnavailable();
    const hasActiveConnector = eligibleConnectors(connectors).length > 0;
    return systems.map((system) => {
      const methodLabelKey = targetSystemMethodLabelKey(system.method);
      const pendingSeal = system.status === TargetSystemStatus.PendingSeal;
      const active = system.status === TargetSystemStatus.Active;
      const status = resolveTargetSystemStatus(system, connectorsKnown ? connectors : null);
      const statusBadge = targetSystemStatusBadge(status);
      const kind = system.sealed?.kind ?? null;
      const integrityCheckFailed = system.sealed == null && !pendingSeal;
      return {
        id: system.id,
        idText: uuidAsString(system.id),
        system,
        name: system.name,
        methodLabel: methodLabelKey == null ? null : this.i18nService.t(methodLabelKey),
        kind,
        kindLabel: kind != null ? this.kindLabel(kind) : null,
        status,
        statusBadge,
        statusSortOrder: statusBadge.sortOrder,
        active,
        managedCredentialCount:
          credentialCounts == null ? null : (credentialCounts.get(system.id) ?? 0),
        connectorIds: connectors
          .filter((connector) => connector.assignedTargetSystemIds.includes(system.id))
          .map((connector) => String(connector.id)),
        integrityCheckFailed,
        canAssignConnectors: system.method === TargetSystemMethod.Automatic,
        canAddManagedCredential: active,
        assignConnectorsBlockedKey: connectorsUnavailable
          ? "pamTargetSystemConnectorAssignmentsLoadError"
          : !connectorsKnown || assignableConnectors(system.id, connectors).length > 0
            ? null
            : hasActiveConnector
              ? "pamTargetSystemAssignConnectorNoOptions"
              : "pamTargetSystemAssignConnectorNone",
        managedCredentialsQueryParams: { [TARGET_SYSTEM_QUERY_PARAM]: uuidAsString(system.id) },
        deleteBlocked: (credentialCounts?.get(system.id) ?? 0) > 0,
        activationBlockedKey: pendingSeal ? "pamTargetSystemActivationBlockedPendingSeal" : null,
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

/** The toolbar's raw values by filter key, untyped because each chip reports its own shape. */
type TargetSystemFilterValues = {
  search?: string;
  status?: unknown;
  method?: unknown;
  kind?: unknown;
  connector?: unknown;
};

type TargetSystemFilter = {
  text: string;
  statuses: TargetSystemRowStatus[];
  method: TargetSystemMethod | null;
  kinds: TargetSystemKind[];
  connectorIds: string[];
};

/** A multi-select chip reports an array, and a cleared one an empty array. */
function toArray<T>(value: unknown): T[] {
  if (value == null) {
    return [];
  }
  return Array.isArray(value) ? (value as T[]) : [value as T];
}

function toTargetSystemFilter(values: TargetSystemFilterValues): TargetSystemFilter {
  return {
    text: (values.search ?? "").trim().toLowerCase(),
    statuses: toArray<TargetSystemRowStatus>(values.status),
    method: typeof values.method === "string" ? (values.method as TargetSystemMethod) : null,
    kinds: toArray<TargetSystemKind>(values.kind),
    connectorIds: toArray<string>(values.connector),
  };
}

function matchesFilter(row: TargetSystemRow, filter: TargetSystemFilter): boolean {
  const { text, statuses, method, kinds, connectorIds } = filter;
  if (
    text !== "" &&
    !row.name.toLowerCase().includes(text) &&
    !(row.kindLabel?.toLowerCase().includes(text) ?? false)
  ) {
    return false;
  }
  if (statuses.length > 0 && !statuses.includes(row.status)) {
    return false;
  }
  if (method != null && row.system.method !== method) {
    return false;
  }
  if (kinds.length > 0 && (row.kind == null || !kinds.includes(row.kind))) {
    return false;
  }
  if (connectorIds.length > 0 && !connectorIds.some((id) => row.connectorIds.includes(id))) {
    return false;
  }
  return true;
}
