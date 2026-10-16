import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { RouterModule } from "@angular/router";
import { EMPTY, distinctUntilChanged, filter, map, switchMap } from "rxjs";

import { IconComponent } from "@bitwarden/angular/vault/components/icon.component";
import { NoResults } from "@bitwarden/assets/svg";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { skeletonLoadingDelay } from "@bitwarden/common/vault/utils/skeleton-loading.operator";
import {
  BitCellComponent,
  BitCellDefDirective,
  BitCellLoadingDirective,
  BitColumnComponent,
  BitHeaderCellComponent,
  BitTableToolbarComponent,
  BitTableV2Component,
  ColumnName,
  FilterMenuComponent,
  FilterOptionComponent,
  FilterOptionIconTile,
  IconButtonModule,
  IconModule,
  SearchModule,
  SkeletonComponent,
  SkeletonTextComponent,
  SortFn,
  StatusLockupComponent,
  SvgComponent,
  TypographyModule,
  defineTable,
  isAtOrLargerThanBreakpointSignal,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import type { AccessDecisionVerdict, AccessLeaseId } from "../abstractions/access-lease";
import { AccessBadgeState } from "../access-state-badge/access-badge-state";
import { AccessBadgeTickerService } from "../access-state-badge/access-badge-ticker.service";
import { AccessStateBadgeComponent } from "../access-state-badge/access-state-badge.component";
import { ApproverActionsService, rowBusy } from "../approvals/approver-actions.service";
import { ApproverInboxService } from "../approvals/approver-inbox.service";
import {
  ApproverRow,
  ApproverRowStatus,
  approverBadgeState,
  approverRowStatus,
  compareApproverStatus,
} from "../approvals/approver-row";
import { selectedFilterStrings } from "../helpers/selected-filter-strings";

type ApprovalsColumn = ColumnName<ApproverRow, "status" | "window" | "actions">;

/** The table's `filterValues()`, keyed by each toolbar control's `key`. Untyped, as a chip's is. */
type ApprovalsFilterValues = {
  search?: unknown;
  status?: unknown;
  collection?: unknown;
  requester?: unknown;
};

/** An empty list means that filter is unset. */
type ApprovalsFilter = {
  term: string;
  statuses: string[];
  collections: string[];
  requesters: string[];
};

type FilterOption = { label: string; value: string; iconTile?: FilterOptionIconTile };

/** The Status chip's options, each with its status badge's icon. */
const STATUS_OPTIONS: ReadonlyArray<{
  value: ApproverRowStatus;
  labelKey: string;
  iconTile: FilterOptionIconTile;
}> = [
  {
    value: ApproverRowStatus.Pending,
    labelKey: "pamAccessBadgePending",
    iconTile: { icon: "bwi-clock", variant: "warning" },
  },
  {
    value: ApproverRowStatus.Ready,
    labelKey: "pamAccessBadgeReady",
    iconTile: { icon: "bwi-check-circle", variant: "success" },
  },
  {
    value: ApproverRowStatus.InUse,
    labelKey: "pamApprovalsStatusInUse",
    iconTile: { icon: "bwi-unlock", variant: "teal" },
  },
  {
    value: ApproverRowStatus.EndingSoon,
    labelKey: "pamApprovalsStatusEndingSoon",
    iconTile: { icon: "bwi-warning", variant: "danger" },
  },
];

/**
 * Every request the approver can still act on, in one table: awaiting a decision, approved but not
 * started, and running. A row leaves once its access ends, or straight away when denied.
 */
@Component({
  selector: "pam-approvals-tab",
  templateUrl: "./approvals-tab.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterModule,
    AccessStateBadgeComponent,
    BitCellComponent,
    BitCellDefDirective,
    BitCellLoadingDirective,
    BitColumnComponent,
    BitHeaderCellComponent,
    BitTableToolbarComponent,
    BitTableV2Component,
    FilterMenuComponent,
    FilterOptionComponent,
    IconButtonModule,
    IconComponent,
    IconModule,
    SearchModule,
    SkeletonComponent,
    SkeletonTextComponent,
    StatusLockupComponent,
    SvgComponent,
    TypographyModule,
    I18nPipe,
  ],
  providers: [ApproverActionsService],
})
export class ApprovalsTabComponent {
  protected readonly noResultsSvg = NoResults;

  private readonly inbox = inject(ApproverInboxService);
  private readonly approverActions = inject(ApproverActionsService);
  private readonly ticker = inject(AccessBadgeTickerService);
  private readonly i18nService = inject(I18nService);

  /** The ids of rows whose action is in flight. */
  private readonly acting = signal<Set<string>>(new Set());

  protected readonly loading = toSignal(this.inbox.loading$, { initialValue: true });

  /** Held back until the load has run for a second, so a quick inbox never flashes the skeleton. */
  protected readonly showSkeleton = toSignal(
    this.inbox.loading$.pipe(distinctUntilChanged(), skeletonLoadingDelay()),
    { initialValue: false },
  );

  /** Latched, since only the first load has nothing rendered to leave on screen. */
  private readonly hasLoadedOnce = toSignal(
    this.inbox.loading$.pipe(
      filter((loading) => !loading),
      map(() => true),
    ),
    { initialValue: false },
  );

  private readonly loadError = toSignal(this.inbox.loadError$, { initialValue: null });

  private readonly allRows = toSignal(this.inbox.approverRows$, {
    initialValue: [] as ApproverRow[],
  });

  /**
   * Shares the badges' clock, so a lapsed row drops off and a lease turns "Ending soon" under the
   * Status filter. Idle while every row is pending, since none of those has a clock to watch.
   */
  private readonly nowMs = toSignal(
    toObservable(computed(() => this.allRows().some((row) => row.kind !== "pending"))).pipe(
      switchMap((timed) => (timed ? this.ticker.ticks$ : EMPTY)),
    ),
    { initialValue: Date.now() },
  );

  /**
   * Approvals and leases still inside their window by a live clock, since either can lapse with no
   * push. Compared by identity so the tick only reaches the table when rows change.
   */
  protected readonly rows = computed<ApproverRow[]>(
    () => this.allRows().filter((row) => row.kind === "pending" || row.windowEndMs > this.nowMs()),
    { equal: sameRows },
  );

  private readonly cipherById = toSignal(this.inbox.cipherById$, {
    initialValue: new Map<string, CipherView>(),
  });

  protected readonly statusOptions: FilterOption[] = STATUS_OPTIONS.map((option) => ({
    value: option.value,
    label: this.i18nService.t(option.labelKey),
    iconTile: option.iconTile,
  }));

  /** Every distinct shared folder present on the tab. */
  protected readonly collectionOptions = computed<FilterOption[]>(() =>
    distinctOptions(this.rows().map((row) => row.collectionName)),
  );

  /** Every distinct requester present on the tab. */
  protected readonly requesterOptions = computed<FilterOption[]>(() =>
    distinctOptions(this.rows().map((row) => row.requester)),
  );

  /** Separates an empty inbox from a filter that matched nothing, which keeps the toolbar up. */
  protected readonly hasRows = computed(() => this.rows().length > 0);

  /**
   * Also drives the `role="status"` announcement, so a load finishing inside the delay never
   * announces a screen the user wasn't shown.
   */
  protected readonly skeletonVisible = computed(() => this.showSkeleton() && !this.hasRows());

  /**
   * Whether the loading region replaces the tab. It covers all of the first load but later only the
   * skeleton's time, so a reload of an empty inbox keeps its empty state up.
   */
  protected readonly loadingVisible = computed(() =>
    this.hasLoadedOnce()
      ? this.skeletonVisible()
      : (this.loading() || this.showSkeleton()) && !this.hasRows(),
  );

  /** The row actions show on row hover or keyboard focus, as the vault items table's do. */
  protected readonly revealClasses =
    "tw-flex tw-flex-nowrap tw-items-center tw-gap-2 tw-opacity-0 tw-transition-opacity" +
    " tw-pointer-events-none group-hover/row:tw-opacity-100 group-hover/row:tw-pointer-events-auto" +
    " group-has-[:focus-visible]/row:tw-opacity-100" +
    " group-has-[:focus-visible]/row:tw-pointer-events-auto";

  /** Five rows fill the table's space without implying a real row count. */
  protected readonly skeletonRows = 5;

  /**
   * Whether the current load showed its skeleton, so its removal can be announced. Reset per load
   * so a retry doesn't inherit the last attempt's.
   */
  private readonly skeletonShown = signal(false);

  /**
   * Announces arrival only after a shown skeleton and a successful load, since a failed load leaves
   * the same empty table and "loaded" would contradict the shell's error toast.
   */
  protected readonly announceLoaded = computed(
    () => this.skeletonShown() && !this.skeletonVisible() && this.loadError() == null,
  );

  /**
   * Fed the unfiltered rows, since the projected toolbar filters through {@link rowMatchesFilter}
   * and counts each chip's options against them.
   */
  protected readonly table = defineTable<ApproverRow, "status" | "window" | "actions">(this.rows);

  private readonly atLeastLg = isAtOrLargerThanBreakpointSignal("lg");

  /**
   * A v2 column is a grid track, so a breakpoint class on its cells would leave an empty track
   * behind; narrow viewports drop columns by omission instead. The detail dialog, reached from
   * the item, carries whatever is dropped.
   */
  protected readonly displayedColumns = computed<ApprovalsColumn[]>(() => [
    "cipherName",
    "status",
    "requester",
    ...(this.atLeastLg() ? (["window"] as const) : []),
    "actions",
  ]);

  /** Memoised per row so each badge's input keeps its identity across ticks. */
  private readonly badgeStates = computed(
    () => new Map(this.rows().map((row) => [row.id, approverBadgeState(row)])),
  );

  constructor() {
    effect(() => {
      if (this.skeletonVisible()) {
        this.skeletonShown.set(true);
      } else if (this.loading()) {
        this.skeletonShown.set(false);
      }
    });
  }

  /** Reads the clock, so a lease crossing into "Ending soon" re-files under the Status filter. */
  protected readonly rowMatchesFilter = (
    row: ApproverRow,
    values: ApprovalsFilterValues,
  ): boolean => matchesFilter(row, toApprovalsFilter(values), this.nowMs());

  protected readonly sortByStatus: SortFn = (a: ApproverRow, b: ApproverRow) =>
    compareApproverStatus(a, b);

  protected readonly sortByWindow: SortFn = (a: ApproverRow, b: ApproverRow) =>
    a.windowStartMs - b.windowStartMs;

  protected cipherFor(cipherId: string): CipherView | undefined {
    return this.cipherById().get(cipherId);
  }

  protected badgeState(row: ApproverRow): AccessBadgeState | null {
    return this.badgeStates().get(row.id) ?? null;
  }

  protected isActing(row: ApproverRow): boolean {
    return this.acting().has(row.id);
  }

  protected async decide(row: ApproverRow, verdict: AccessDecisionVerdict): Promise<void> {
    if (row.kind !== "pending" || !row.approval.canDecide || this.isActing(row)) {
      return;
    }
    await this.approverActions.decide(
      { verdict, row: row.approval, cipher: this.cipherFor(row.cipherId) },
      (decided, comment) => this.inbox.decide(row.requestId, decided, comment),
      rowBusy(this.acting, row.id),
    );
  }

  /**
   * An approval not yet started is withdrawn, which needs no lease; a running one has its lease
   * ended.
   */
  protected async revoke(row: ApproverRow): Promise<void> {
    if (row.kind === "pending" || this.isActing(row)) {
      return;
    }
    if (row.kind === "ready") {
      await this.approverActions.withdrawApproval(
        row.cipherName,
        () => this.inbox.cancelApproval(row.requestId),
        rowBusy(this.acting, row.id),
      );
      return;
    }
    const leaseId: AccessLeaseId = row.lease.leaseId;
    await this.approverActions.revoke(
      () => this.inbox.revokeLease(row.requestId, leaseId),
      rowBusy(this.acting, row.id),
    );
  }
}

/** OR within a filter, AND across them. */
function matchesFilter(row: ApproverRow, filter: ApprovalsFilter, nowMs: number): boolean {
  return (
    (filter.term === "" || row.searchText.includes(filter.term)) &&
    (filter.statuses.length === 0 || filter.statuses.includes(approverRowStatus(row, nowMs))) &&
    (filter.collections.length === 0 ||
      (row.collectionName != null && filter.collections.includes(row.collectionName))) &&
    (filter.requesters.length === 0 || filter.requesters.includes(row.requester))
  );
}

function toApprovalsFilter(values: ApprovalsFilterValues): ApprovalsFilter {
  return {
    term: typeof values.search === "string" ? values.search.trim().toLowerCase() : "",
    statuses: selectedFilterStrings(values.status),
    collections: selectedFilterStrings(values.collection),
    requesters: selectedFilterStrings(values.requester),
  };
}

function sameRows(a: readonly ApproverRow[], b: readonly ApproverRow[]): boolean {
  return a.length === b.length && a.every((row, index) => row === b[index]);
}

function distinctOptions(labels: Array<string | null>): FilterOption[] {
  const distinct = new Set(labels.filter((label): label is string => !!label));
  return [...distinct].sort((a, b) => a.localeCompare(b)).map((label) => ({ value: label, label }));
}
