import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { RouterModule } from "@angular/router";
import {
  combineLatest,
  distinctUntilChanged,
  filter,
  map,
  shareReplay,
  startWith,
  take,
} from "rxjs";

import { IconComponent } from "@bitwarden/angular/vault/components/icon.component";
import { NoResults } from "@bitwarden/assets/svg";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SyncService } from "@bitwarden/common/platform/sync";
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
  FilterMenuComponent,
  FilterOptionComponent,
  IconModule,
  SearchModule,
  SkeletonComponent,
  SkeletonTextComponent,
  SortFn,
  StatusLockupComponent,
  SvgComponent,
  TooltipDirective,
  TypographyModule,
  defineTable,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { AccessBadgeTickerService } from "../access-state-badge/access-badge-ticker.service";
import { ApprovalPrivilegeService } from "../approvals/approval-privilege.service";
import { ApproverInboxService } from "../approvals/approver-inbox.service";
import { ElapsedLabel, elapsedLabel } from "../date/elapsed";
import { selectedFilterStrings } from "../helpers/selected-filter-strings";

import {
  HISTORY_STATUS_LABEL_KEYS,
  HistoryResolver,
  HistoryRow,
  HistoryStatus,
  toHistoryRow,
} from "./history-row";
import { MyAccessRequestRow } from "./my-access-row";
import { MyAccessService } from "./my-access.service";

/** A History row with its Resolved label, which moves with the clock. */
type HistoryTableRow = HistoryRow & { elapsed: ElapsedLabel };

/** The table's `filterValues()`, keyed by each toolbar control's `key`. Untyped, as a chip's is. */
type HistoryFilterValues = {
  search?: unknown;
  status?: unknown;
  collection?: unknown;
  requester?: unknown;
};

/** An empty list means that filter is unset. */
type HistoryFilter = {
  term: string;
  statuses: string[];
  collections: string[];
  requesters: string[];
};

type FilterOption = { label: string; value: string };

/**
 * How long the "loaded" announcement stays in the live region, long enough to be read but not to
 * linger as a stale claim.
 */
const announcementHoldMs = 2000;

const minuteMs = 60_000;

/**
 * A read-only record of every request that reached an end state, merged from the caller's own
 * requests and those on collections they manage.
 */
@Component({
  selector: "pam-history-tab",
  templateUrl: "./history-tab.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterModule,
    BitCellComponent,
    BitCellDefDirective,
    BitCellLoadingDirective,
    BitColumnComponent,
    BitHeaderCellComponent,
    BitTableToolbarComponent,
    BitTableV2Component,
    FilterMenuComponent,
    FilterOptionComponent,
    IconComponent,
    IconModule,
    SearchModule,
    SkeletonComponent,
    SkeletonTextComponent,
    StatusLockupComponent,
    SvgComponent,
    TooltipDirective,
    TypographyModule,
    I18nPipe,
  ],
})
export class HistoryTabComponent {
  protected readonly noResultsSvg = NoResults;

  private readonly myAccess = inject(MyAccessService);
  private readonly inbox = inject(ApproverInboxService);
  private readonly approvalPrivileges = inject(ApprovalPrivilegeService);
  private readonly syncService = inject(SyncService);
  private readonly ticker = inject(AccessBadgeTickerService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly i18nService = inject(I18nService);

  private readonly myRows = toSignal(this.myAccess.historyRows$, {
    initialValue: [] as MyAccessRequestRow[],
  });
  private readonly managedRows = toSignal(this.inbox.historyRows$, {
    initialValue: [] as MyAccessRequestRow[],
  });

  private readonly myCiphers = toSignal(this.myAccess.cipherById$, {
    initialValue: new Map<string, CipherView>(),
  });
  private readonly managedCiphers = toSignal(this.inbox.cipherById$, {
    initialValue: new Map<string, CipherView>(),
  });

  private readonly myLoadError = toSignal(this.myAccess.loadError$, { initialValue: null });
  private readonly managedLoadError = toSignal(this.inbox.loadError$, { initialValue: null });

  /**
   * The badges' clock, to the minute: enough to move the Resolved labels and to bring in a lease
   * that lapsed while the tab was open, which no push announces.
   */
  private readonly nowMs = toSignal(
    this.ticker.ticks$.pipe(
      map((ms) => Math.floor(ms / minuteMs) * minuteMs),
      distinctUntilChanged(),
    ),
    { initialValue: Date.now() },
  );

  /** A failed read leaves the merged list short of that side's rows, which the table can't show. */
  private readonly loadFailed = computed(
    () => this.myLoadError() != null || this.managedLoadError() != null,
  );

  /**
   * Latched on the first complete load, so a background reload can't pull the table from under a
   * reader. Waits on the inbox for an approver, or for anyone before the first sync, when
   * `canApprove$` can read false.
   */
  private readonly historyLoaded$ = combineLatest([
    this.myAccess.loading$,
    this.inbox.loading$,
    this.approvalPrivileges.canApprove$,
    this.syncService.activeUserLastSync$(),
  ]).pipe(
    filter(
      ([myLoading, inboxLoading, canApprove, lastSync]) =>
        !myLoading && !((canApprove || lastSync == null) && inboxLoading),
    ),
    take(1),
    map(() => true),
    startWith(false),
    takeUntilDestroyed(this.destroyRef),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  protected readonly historyLoaded = toSignal(this.historyLoaded$, { initialValue: false });

  /** Held back for a second of loading, so a quick history never flashes the skeleton. */
  private readonly showSkeleton = toSignal(
    this.historyLoaded$.pipe(
      map((loaded) => !loaded),
      distinctUntilChanged(),
      skeletonLoadingDelay(),
    ),
    { initialValue: false },
  );

  /**
   * Also drives the `role="status"` announcement, so a load inside the delay never announces a
   * screen the user wasn't shown. The `historyLoaded()` term stops the region announcing "loading"
   * over a rendered table.
   */
  protected readonly skeletonVisible = computed(() => this.showSkeleton() && !this.historyLoaded());

  /** Raised once the skeleton shows, so its removal can be announced; lowered after the hold. */
  private readonly skeletonShown = signal(false);

  /**
   * Announces arrival only after a shown skeleton and no failed read, since a failure also resolves
   * the latch and "loaded" would contradict the shell's error toast.
   */
  protected readonly announceLoaded = computed(
    () => this.skeletonShown() && !this.skeletonVisible() && !this.loadFailed(),
  );

  /**
   * Every ended request, newest first. A row both reads return keeps the caller's own copy, which
   * alone carries the lease's extended end.
   */
  protected readonly rows = computed<HistoryTableRow[]>(() => {
    const rowsById = new Map(this.myRows().map((row) => [String(row.id), row]));
    for (const row of this.managedRows()) {
      if (!rowsById.has(String(row.id))) {
        rowsById.set(String(row.id), row);
      }
    }
    const nowMs = this.nowMs();
    const now = new Date(nowMs);
    return [...rowsById.values()]
      .map((row) => toHistoryRow(row, nowMs))
      .filter((row): row is HistoryRow => row != null)
      .map((row) => ({ ...row, elapsed: elapsedLabel(row.resolvedAt, now) }))
      .sort((a, b) => b.resolvedAtMs - a.resolvedAtMs);
  });

  protected readonly hasHistory = computed(() => this.rows().length > 0);

  /** Plain options, without the icon tiles the other tabs' Status filters carry. */
  protected readonly statusOptions: FilterOption[] = Object.values(HistoryStatus).map((status) => ({
    value: status,
    label: this.i18nService.t(HISTORY_STATUS_LABEL_KEYS[status]),
  }));

  /** Every distinct shared folder present on the tab. */
  protected readonly collectionOptions = computed<FilterOption[]>(() =>
    distinctOptions(this.rows().map((row) => row.collectionName)),
  );

  /** Every distinct requester present on the tab. */
  protected readonly requesterOptions = computed<FilterOption[]>(() =>
    distinctOptions(this.rows().map((row) => row.requester)),
  );

  /**
   * Fed the unfiltered rows, since the projected toolbar filters through {@link rowMatchesFilter}
   * and counts each chip's options against them.
   */
  protected readonly table = defineTable<HistoryTableRow>(this.rows);

  /** Five rows fill the table's space without implying a real row count. */
  protected readonly skeletonRows = 5;

  constructor() {
    effect((onCleanup) => {
      if (this.skeletonVisible()) {
        this.skeletonShown.set(true);
        return;
      }
      if (!untracked(this.skeletonShown)) {
        return;
      }
      const handle = setTimeout(() => this.skeletonShown.set(false), announcementHoldMs);
      onCleanup(() => clearTimeout(handle));
    });
  }

  protected readonly rowMatchesFilter = (row: HistoryTableRow, values: HistoryFilterValues) =>
    this.matchesFilter(row, toHistoryFilter(values));

  /** By the label the column shows, not the status's internal value. */
  protected readonly sortByStatus: SortFn = (a: HistoryTableRow, b: HistoryTableRow) =>
    this.statusLabel(a.status).localeCompare(this.statusLabel(b.status));

  protected statusLabel(status: HistoryStatus): string {
    return this.i18nService.t(HISTORY_STATUS_LABEL_KEYS[status]);
  }

  protected resolverLabel(resolver: HistoryResolver): string {
    if (resolver.kind === "system") {
      return this.i18nService.t("system");
    }
    return resolver.name ?? this.i18nService.t("pamResolverUnknown");
  }

  /** The decrypted cipher for a row, undefined when absent from the caller's vault. */
  protected cipherFor(cipherId: string): CipherView | undefined {
    return this.myCiphers().get(cipherId) ?? this.managedCiphers().get(cipherId);
  }

  /** OR within a filter, AND across them. Searches the text the row shows. */
  private matchesFilter(row: HistoryTableRow, filter: HistoryFilter): boolean {
    return (
      (filter.term === "" ||
        [
          row.cipherName,
          row.collectionName,
          row.requester,
          row.requesterEmail,
          this.statusLabel(row.status),
          this.resolverLabel(row.resolvedBy),
        ].some((field) => field != null && field.toLowerCase().includes(filter.term))) &&
      (filter.statuses.length === 0 || filter.statuses.includes(row.status)) &&
      (filter.collections.length === 0 ||
        (row.collectionName != null && filter.collections.includes(row.collectionName))) &&
      (filter.requesters.length === 0 || filter.requesters.includes(row.requester))
    );
  }
}

function toHistoryFilter(values: HistoryFilterValues): HistoryFilter {
  return {
    term: typeof values.search === "string" ? values.search.trim().toLowerCase() : "",
    statuses: selectedFilterStrings(values.status),
    collections: selectedFilterStrings(values.collection),
    requesters: selectedFilterStrings(values.requester),
  };
}

function distinctOptions(labels: Array<string | null>): FilterOption[] {
  const distinct = new Set(labels.filter((label): label is string => !!label));
  return [...distinct].sort((a, b) => a.localeCompare(b)).map((label) => ({ value: label, label }));
}
