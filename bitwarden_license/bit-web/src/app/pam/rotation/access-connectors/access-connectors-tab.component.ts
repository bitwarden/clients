import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  viewChildren,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { filter, firstValueFrom, map } from "rxjs";

import {
  accessConnectorDeactivateConfirmOptions,
  accessConnectorDeleteConfirmOptions,
  TimestampPipe,
} from "@bitwarden/bit-pam-components";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { asUuid } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import {
  AsyncActionsModule,
  BadgeModule,
  BitCellComponent,
  BitCellDefDirective,
  BitColumnComponent,
  BitHeaderCellComponent,
  BitTableToolbarComponent,
  BitTableV2Component,
  ButtonModule,
  DialogService,
  FilterMenuComponent,
  FilterMenuModule,
  IconButtonModule,
  IconModule,
  LinkModule,
  MenuModule,
  SearchModule,
  StatusLockupComponent,
  ToastService,
  TooltipDirective,
  defineTable,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { assignableTargetSystems } from "../assignable";
import { filterOptions } from "../filter-options";
import { AccessConnectorId, TargetSystemId, TargetSystemView } from "../rotation";
import { rotationActionErrorMessage, rotationErrorMessage } from "../rotation-error";
import { RotationLoadErrorComponent } from "../rotation-load-error.component";
import { RotationLoadingAnnouncerComponent } from "../rotation-loading-announcer.component";
import { lastSeenText, relativeTimeLabel } from "../rotation-relative-time";
import { RowBusyTracker } from "../row-busy-tracker";
import { TargetSystemsService } from "../target-systems/target-systems.service";

import {
  ACCESS_CONNECTOR_STATUS_BADGES,
  AccessConnectorDisplayStatus,
  AccessConnectorStatusBadge,
  accessConnectorDisplayStatus,
  accessConnectorStatusBadge,
} from "./access-connector-label";
import { AccessConnectorRegisterDialogComponent } from "./access-connector-register-dialog.component";
import { AccessConnectorRow, AccessConnectorsService } from "./access-connectors.service";
import { AssignTargetDialogComponent } from "./assign-target-dialog.component";

export type AccessConnectorTabRow = AccessConnectorRow & {
  /** The one status badge the row shows: Inactive, else Disconnected, else Connected. */
  readonly statusBadge: AccessConnectorStatusBadge;
  /** The target systems cell: "None", or how many are assigned. */
  readonly targetSystemsLabel: string;
  /** The i18n key for why the menu can't assign a target system now, or null when it can. */
  readonly assignTargetsBlockedKey: string | null;
  /** The relative last-seen wording, or null when the design shows none and the cell shows a date. */
  readonly lastSeenLabel: string | null;
};

@Component({
  selector: "app-access-connectors-tab",
  templateUrl: "./access-connectors-tab.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TimestampPipe,
    ReactiveFormsModule,
    AsyncActionsModule,
    BadgeModule,
    ButtonModule,
    FilterMenuModule,
    IconButtonModule,
    IconModule,
    LinkModule,
    MenuModule,
    SearchModule,
    StatusLockupComponent,
    BitTableToolbarComponent,
    BitTableV2Component,
    BitColumnComponent,
    BitHeaderCellComponent,
    BitCellComponent,
    BitCellDefDirective,
    TooltipDirective,
    RotationLoadErrorComponent,
    RotationLoadingAnnouncerComponent,
    I18nPipe,
  ],
})
export class AccessConnectorsTabComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly accessConnectorsService = inject(AccessConnectorsService);
  private readonly targetSystemsService = inject(TargetSystemsService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);

  protected readonly loading = toSignal(this.accessConnectorsService.loading$, {
    initialValue: true,
  });
  protected readonly loadError = toSignal(this.accessConnectorsService.loadError$, {
    initialValue: null,
  });

  private readonly serviceRows = toSignal(this.accessConnectorsService.rows$, {
    initialValue: [] as AccessConnectorRow[],
  });
  private readonly automaticSystems = toSignal(this.targetSystemsService.automaticSystems$, {
    initialValue: [] as TargetSystemView[],
  });
  private readonly targetSystemsLoading = toSignal(this.targetSystemsService.loading$, {
    initialValue: true,
  });
  private readonly targetSystemsLoadError = toSignal(this.targetSystemsService.loadError$, {
    initialValue: null,
  });

  /** Whether the target-system list has been read successfully. */
  private readonly targetSystemsKnown = computed(
    () => !this.targetSystemsLoading() && this.targetSystemsLoadError() == null,
  );

  /** Whether the target-system read has landed and failed, so there is no list to offer. */
  private readonly targetSystemsUnavailable = computed(
    () => !this.targetSystemsLoading() && this.targetSystemsLoadError() != null,
  );

  private readonly rows = computed<AccessConnectorTabRow[]>(() => {
    const eligible = this.automaticSystems();
    const known = this.targetSystemsKnown();
    // Read once per rows change, so relative labels such as "5m ago" are not live-updating.
    const now = Date.now();
    const unavailable = this.targetSystemsUnavailable();
    return this.serviceRows().map((row) => ({
      ...row,
      statusBadge: accessConnectorStatusBadge(accessConnectorDisplayStatus(row.accessConnector)),
      targetSystemsLabel: this.targetSystemsLabel(row.assignmentNames.length),
      assignTargetsBlockedKey: this.assignTargetsBlockedKey(row, eligible, known, unavailable),
      lastSeenLabel:
        row.lastSeenAtMs == null
          ? null
          : relativeTimeLabel(this.i18nService, lastSeenText(row.lastSeenAtMs, now)),
    }));
  });

  protected readonly table = defineTable<AccessConnectorTabRow, "actions">(this.rows);

  /**
   * Urgency first (Disconnected, Inactive, Connected), then most target systems, then name. The
   * two tie-breaks hold whichever way the column is sorted.
   */
  protected readonly sortByStatus = (
    a: AccessConnectorTabRow,
    b: AccessConnectorTabRow,
    direction?: "asc" | "desc",
  ): number => {
    const flip = direction === "desc" ? -1 : 1;
    return (
      a.statusBadge.sortOrder - b.statusBadge.sortOrder ||
      flip * (b.assignmentNames.length - a.assignmentNames.length) ||
      flip * a.name.localeCompare(b.name)
    );
  };

  protected readonly sortByLastSeen = withNameTieBreak(
    (a, b) => (a.lastSeenAtMs ?? -Infinity) - (b.lastSeenAtMs ?? -Infinity) || 0,
  );

  protected readonly sortByAssignments = withNameTieBreak(
    (a, b) => a.assignmentNames.length - b.assignmentNames.length,
  );

  protected readonly searchControl = new FormControl("", { nonNullable: true });

  private readonly filterMenus = viewChildren(FilterMenuComponent);

  /** The status filter offers every status, in urgency order, named and iconed like its badge. */
  protected readonly statusBadges = ACCESS_CONNECTOR_STATUS_BADGES.map((badge) => ({
    ...badge,
    iconTile: { icon: badge.icon, variant: badge.tileVariant },
  }));

  /** Every target system a connector serves or could be assigned, so an unserved one counts 0. */
  protected readonly targetSystemOptions = computed(() =>
    filterOptions<string>([
      ...this.automaticSystems().map((system) => [String(system.id), system.name] as const),
      ...this.rows().flatMap((row) =>
        row.accessConnector.assignedTargetSystemIds.map(
          (id, i) => [String(id), row.assignmentNames[i]] as const,
        ),
      ),
    ]),
  );

  private readonly organizationId = toSignal(
    this.route.params.pipe(map((p) => p["organizationId"] as OrganizationId)),
    { requireSync: true },
  );

  private readonly busyRows = new RowBusyTracker<AccessConnectorId>();

  protected readonly isRowBusy = this.busyRows.isBusy;

  /** The table's row test; the toolbar passes its search and chip values as `values`. */
  protected readonly rowMatchesFilter = (
    row: AccessConnectorTabRow,
    values: AccessConnectorFilterValues,
  ): boolean => matchesFilter(row, toAccessConnectorFilter(values));

  constructor() {
    effect(() => {
      void this.loadAll(this.organizationId());
    });
  }

  protected readonly totalRows = computed(() => this.rows().length);

  /** Resets every chip and the search box, for the empty state shown when they match nothing. */
  protected readonly clearFilters = (): void => {
    this.filterMenus().forEach((menu) => menu.clear());
    this.searchControl.setValue("");
  };

  private targetSystemsLabel(count: number): string {
    if (count === 0) {
      return this.i18nService.t("pamAccessConnectorAssignmentsNone");
    }
    return this.i18nService.t(
      count === 1
        ? "pamAccessConnectorTargetSystemCountSingular"
        : "pamAccessConnectorTargetSystemCount",
      count,
    );
  }

  /**
   * Why this connector can take no target-system assignment, as the i18n key the menu item's
   * reason line states, or null when it can.
   *
   * A failed read is stated here rather than only on the click, mirroring the target-systems tab's
   * `assignConnectorsBlockedKey`: the item is live while the read is in flight, so
   * {@link openAssignDialog}'s toast covers only the click that arrives before the failure does.
   */
  private assignTargetsBlockedKey(
    row: AccessConnectorRow,
    eligible: readonly TargetSystemView[],
    targetSystemsKnown: boolean,
    targetSystemsUnavailable: boolean,
  ): string | null {
    if (!row.canAssign) {
      return "pamAccessConnectorAssignTargetSystemsDisabled";
    }
    if (targetSystemsUnavailable) {
      return "pamAccessConnectorTargetSystemsLoadError";
    }
    if (!targetSystemsKnown) {
      return null;
    }
    if (eligible.length === 0) {
      return "pamAccessConnectorAssignNoTargetSystems";
    }
    return assignableTargetSystems(row.accessConnector.assignedTargetSystemIds, eligible).length ===
      0
      ? "pamAccessConnectorAssignNoOptions"
      : null;
  }

  private async loadAll(organizationId: OrganizationId): Promise<void> {
    await Promise.all([
      this.accessConnectorsService.load(organizationId),
      this.targetSystemsService.load(organizationId),
    ]);
  }

  /** Whether the operator has asked for a retry, which decides where focus lands on a re-render. */
  protected readonly retried = signal(false);

  protected readonly retryLoad = (): Promise<void> => {
    this.retried.set(true);
    return this.loadAll(this.organizationId());
  };

  protected readonly openDetail = (row: AccessConnectorRow): Promise<boolean> =>
    this.router.navigate(["..", "access-connectors", row.id], { relativeTo: this.route });

  /** Bound to the empty state's register button. */
  protected readonly registerAccessConnector = async (): Promise<void> => {
    const orgId = this.organizationId();
    const ref = AccessConnectorRegisterDialogComponent.open(this.dialogService, {
      data: { organizationId: orgId },
    });
    const result = await ref.closed.toPromise();
    if (result) {
      await this.accessConnectorsService.registerCompleted(orgId);
    }
  };

  /**
   * The menu item is live while the target-system read is in flight, so this waits for it to
   * settle rather than offer an incomplete list. A failed read toasts instead, and leaving the tab
   * mid-wait opens nothing.
   */
  protected readonly openAssignDialog = (row: AccessConnectorRow): Promise<void> =>
    this.busyRows.run(row.id, async () => {
      const stillMounted = await firstValueFrom(
        this.targetSystemsService.loading$.pipe(
          filter((inFlight) => !inFlight),
          map(() => true),
          takeUntilDestroyed(this.destroyRef),
        ),
        { defaultValue: false },
      );
      if (!stillMounted) {
        return;
      }
      if (this.targetSystemsUnavailable()) {
        this.toastService.showToast({
          variant: "error",
          message: this.i18nService.t("pamAccessConnectorTargetSystemsLoadError"),
        });
        return;
      }

      const activeSystems = this.automaticSystems();
      const options = assignableTargetSystems(
        row.accessConnector.assignedTargetSystemIds,
        activeSystems,
      );

      const ref = AssignTargetDialogComponent.open(this.dialogService, {
        data: {
          accessConnector: row.accessConnector,
          options,
          noActiveAutomaticSystems: activeSystems.length === 0,
        },
      });
      const targetSystemId = await ref.closed.toPromise();
      if (!targetSystemId) {
        return;
      }
      try {
        await this.accessConnectorsService.assign(
          row.accessConnector,
          asUuid<TargetSystemId>(targetSystemId),
        );
        this.toastService.showToast({
          variant: "success",
          message: this.i18nService.t("pamAccessConnectorAssigned"),
        });
      } catch (e) {
        this.showError(e);
      }
    });

  protected readonly disable = (row: AccessConnectorRow): Promise<void> =>
    this.busyRows.run(row.id, async () => {
      const confirmed = await this.dialogService.openSimpleDialog(
        accessConnectorDeactivateConfirmOptions(),
      );
      if (!confirmed) {
        return;
      }
      try {
        await this.accessConnectorsService.setEnabled(row.accessConnector, false);
        this.toastService.showToast({
          variant: "success",
          message: this.i18nService.t("pamAccessConnectorDeactivated"),
        });
      } catch (e) {
        this.showActionError(e, "pamAccessConnectorDeactivateFailed");
      }
    });

  protected readonly enable = (row: AccessConnectorRow): Promise<void> =>
    this.busyRows.run(row.id, async () => {
      try {
        await this.accessConnectorsService.setEnabled(row.accessConnector, true);
        this.toastService.showToast({
          variant: "success",
          message: this.i18nService.t("pamAccessConnectorActivated"),
        });
      } catch (e) {
        this.showError(e);
      }
    });

  protected readonly confirmDelete = (row: AccessConnectorRow): Promise<void> =>
    this.busyRows.run(row.id, async () => {
      const confirmed = await this.dialogService.openSimpleDialog(
        accessConnectorDeleteConfirmOptions(),
      );
      if (!confirmed) {
        return;
      }
      try {
        await this.accessConnectorsService.delete(row.accessConnector);
        this.toastService.showToast({
          variant: "success",
          message: this.i18nService.t("pamAccessConnectorDeleted"),
        });
      } catch (e) {
        this.showActionError(e, "pamAccessConnectorDeleteFailed");
      }
    });

  private showError(e: unknown): void {
    const message =
      rotationErrorMessage(e) ??
      (e instanceof ErrorResponse ? e.message : undefined) ??
      this.i18nService.t("unexpectedError");
    this.toastService.showToast({ variant: "error", message });
  }

  /** The server's reason for refusing a row action, else that action's own failure copy. */
  private showActionError(e: unknown, fallbackKey: string): void {
    const message = rotationActionErrorMessage(e) ?? this.i18nService.t(fallbackKey);
    this.toastService.showToast({ variant: "error", message });
  }
}

/** The toolbar's raw values by filter key, untyped because each chip reports its own shape. */
type AccessConnectorFilterValues = {
  search?: string;
  status?: unknown;
  targetSystem?: unknown;
};

type AccessConnectorFilter = {
  text: string;
  statuses: AccessConnectorDisplayStatus[];
  targetSystemIds: string[];
};

/** A multi-select chip reports an array and a single-select one a scalar or `null`. */
function toArray<T>(value: unknown): T[] {
  if (value == null) {
    return [];
  }
  return Array.isArray(value) ? (value as T[]) : [value as T];
}

function toAccessConnectorFilter(values: AccessConnectorFilterValues): AccessConnectorFilter {
  return {
    text: (values.search ?? "").trim().toLowerCase(),
    statuses: toArray<AccessConnectorDisplayStatus>(values.status),
    targetSystemIds: toArray<string>(values.targetSystem),
  };
}

function matchesFilter(row: AccessConnectorTabRow, filter: AccessConnectorFilter): boolean {
  const { text, statuses, targetSystemIds } = filter;
  if (text !== "" && !row.name.toLowerCase().includes(text)) {
    return false;
  }
  if (statuses.length > 0 && !statuses.includes(row.statusBadge.status)) {
    return false;
  }
  if (
    targetSystemIds.length > 0 &&
    !row.accessConnector.assignedTargetSystemIds.some((id) => targetSystemIds.includes(String(id)))
  ) {
    return false;
  }
  return true;
}

type RowComparator = (a: AccessConnectorTabRow, b: AccessConnectorTabRow) => number;

/** Ties sort A to Z by name, flipped for descending so they stay A to Z either way. */
function withNameTieBreak(compare: RowComparator) {
  return (a: AccessConnectorTabRow, b: AccessConnectorTabRow, direction?: "asc" | "desc"): number =>
    compare(a, b) || a.name.localeCompare(b.name) * (direction === "desc" ? -1 : 1);
}
