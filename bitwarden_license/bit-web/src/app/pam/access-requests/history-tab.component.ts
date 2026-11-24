import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  TrackByFunction,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
  untracked,
  viewChild,
} from "@angular/core";
import { takeUntilDestroyed, toSignal } from "@angular/core/rxjs-interop";
import { RouterModule } from "@angular/router";
import { distinctUntilChanged, filter, map, shareReplay, startWith, take } from "rxjs";

import { IconComponent } from "@bitwarden/angular/vault/components/icon.component";
import { NoResults } from "@bitwarden/assets/svg";
import {
  AccessRequestHistoryQuery,
  AccessRequestHistoryStatus,
  ElapsedLabel,
  elapsedLabel,
  selectedFilterStrings,
} from "@bitwarden/bit-pam";
import { AccessBadgeTickerService, TimestampPipe } from "@bitwarden/bit-pam-components";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { asUuid } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { skeletonLoadingDelay } from "@bitwarden/common/vault/utils/skeleton-loading.operator";
import {
  BitCellComponent,
  BitCellDefDirective,
  BitCellLoadingDirective,
  BitColumnComponent,
  BitHeaderCellComponent,
  BitTablePaginatorComponent,
  BitTableToolbarComponent,
  BitTableV2Component,
  FilterMenuComponent,
  FilterOptionComponent,
  IconModule,
  SkeletonComponent,
  SkeletonTextComponent,
  StatusLockupComponent,
  SvgComponent,
  TableRowRange,
  ToastService,
  TooltipDirective,
  TypographyModule,
  defineTable,
} from "@bitwarden/components";
import type { CollectionId as SdkCollectionId, UserId as SdkUserId } from "@bitwarden/sdk-internal";
import { I18nPipe } from "@bitwarden/ui-common";

import { announcementHoldMs } from "./announcement-hold";
import { HistoryPageService } from "./history-page.service";
import {
  HISTORY_STATUS_LABEL_KEYS,
  HistoryResolver,
  HistoryRow,
  HistoryStatus,
  toHistoryRow,
} from "./history-row";

/** A History row with its Resolved label, which moves with the clock. */
type HistoryTableRow = HistoryRow & { elapsed: ElapsedLabel };

/** The table's `filterValues()`, keyed by each toolbar control's `key`. Untyped, as a chip's is. */
type HistoryFilterValues = {
  status?: unknown;
  collection?: unknown;
  requester?: unknown;
};

type FilterOption = { label: string; value: string };

const minuteMs = 60_000;

/** The SDK's spelling of each status the Status filter offers. */
const SDK_STATUS: Readonly<Record<HistoryStatus, AccessRequestHistoryStatus>> = Object.freeze({
  [HistoryStatus.Denied]: "denied",
  [HistoryStatus.Revoked]: "revoked",
  [HistoryStatus.Canceled]: "canceled",
  [HistoryStatus.Expired]: "expired",
  [HistoryStatus.SessionEnded]: "session_ended",
});

/**
 * A read-only record of every request that reached an end state, on collections the caller
 * manages and among their own. The server pages, filters and orders it, newest request first.
 */
@Component({
  selector: "pam-history-tab",
  templateUrl: "./history-tab.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterModule,
    BitCellComponent,
    BitCellDefDirective,
    BitCellLoadingDirective,
    BitColumnComponent,
    BitHeaderCellComponent,
    BitTablePaginatorComponent,
    BitTableToolbarComponent,
    BitTableV2Component,
    FilterMenuComponent,
    FilterOptionComponent,
    IconComponent,
    IconModule,
    SkeletonComponent,
    SkeletonTextComponent,
    StatusLockupComponent,
    SvgComponent,
    TooltipDirective,
    TypographyModule,
    I18nPipe,
    TimestampPipe,
  ],
  providers: [HistoryPageService],
})
export class HistoryTabComponent {
  protected readonly noResultsSvg = NoResults;

  private readonly history = inject(HistoryPageService);
  private readonly ticker = inject(AccessBadgeTickerService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);
  private readonly toastService = inject(ToastService);

  private readonly page = toSignal(this.history.page$, { initialValue: null });
  private readonly pageLoading = toSignal(this.history.loading$, { initialValue: true });
  private readonly loadError = toSignal(this.history.loadError$, { initialValue: null });

  private readonly tableRef = viewChild(BitTableV2Component);

  private readonly filterValues = computed<HistoryFilterValues>(
    () => this.tableRef()?.filterValues() ?? {},
  );
  private readonly statuses = computed(() => selectedFilterStrings(this.filterValues().status));
  private readonly collections = computed(() =>
    selectedFilterStrings(this.filterValues().collection),
  );
  private readonly requesters = computed(() =>
    selectedFilterStrings(this.filterValues().requester),
  );
  private readonly filtered = computed(
    () =>
      this.statuses().length > 0 || this.collections().length > 0 || this.requesters().length > 0,
  );

  /** Back to the first page whenever a filter changes. */
  protected readonly pageIndex = linkedSignal({
    source: () => [this.statuses(), this.collections(), this.requesters()],
    computation: () => 0,
  });
  protected readonly pageSize = signal(10);

  /**
   * The badges' clock, to the minute: enough to move the Resolved labels. A request that ends
   * while the tab is open arrives with the next push or page change.
   */
  private readonly nowMs = toSignal(
    this.ticker.ticks$.pipe(
      map((ms) => Math.floor(ms / minuteMs) * minuteMs),
      distinctUntilChanged(),
    ),
    { initialValue: Date.now() },
  );

  /** Latched on the first read, so a later read can't pull the table from under a reader. */
  private readonly historyLoaded$ = this.history.loading$.pipe(
    filter((loading) => !loading),
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
   * the latch and "loaded" would contradict the error toast.
   */
  protected readonly announceLoaded = computed(
    () => this.skeletonShown() && !this.skeletonVisible() && this.loadError() == null,
  );

  /** The page's rows in the server's order, newest request first. */
  protected readonly rows = computed<HistoryTableRow[]>(() => {
    const nowMs = this.nowMs();
    const now = new Date(nowMs);
    return (this.page()?.rows ?? [])
      .map((row) => toHistoryRow(row, nowMs))
      .filter((row): row is HistoryRow => row != null)
      .map((row) => ({ ...row, elapsed: elapsedLabel(row.resolvedAt, now) }));
  });

  /** How many requests match the filters, across all pages. */
  protected readonly total = computed(() => this.page()?.total ?? 0);

  /**
   * A filter that matched nothing keeps the table, so it can be cleared. A failed read keeps it
   * too, since "no history" would not be true.
   */
  protected readonly hasHistory = computed(
    () => this.total() > 0 || this.filtered() || this.loadError() != null,
  );

  /** Shows the table's loading rows while a new page is read, after the first load. */
  protected readonly tableLoading = computed(() => this.historyLoaded() && this.pageLoading());

  /** Plain options, without the icon tiles the other tabs' Status filters carry. */
  protected readonly statusOptions: FilterOption[] = Object.values(HistoryStatus).map((status) => ({
    value: status,
    label: this.i18nService.t(HISTORY_STATUS_LABEL_KEYS[status]),
  }));

  /** Every shared folder with a request in the history, whatever the filters. */
  protected readonly collectionOptions = computed(() => this.page()?.collectionOptions ?? []);

  /** Everyone with a request in the history, whatever the filters. */
  protected readonly requesterOptions = computed(() => this.page()?.requesterOptions ?? []);

  protected readonly table = defineTable<HistoryTableRow>(this.rows);

  /** Five rows fill the table's space without implying a real row count. */
  protected readonly skeletonRows = 5;

  constructor() {
    effect(() => {
      const query: AccessRequestHistoryQuery = {
        page: this.pageIndex(),
        pageSize: this.pageSize(),
        statuses: this.statuses()
          .filter(isHistoryStatus)
          .map((status) => SDK_STATUS[status]),
        collectionIds: this.collections().map((id) => asUuid<SdkCollectionId>(id)),
        requesterIds: this.requesters().map((id) => asUuid<SdkUserId>(id)),
      };
      untracked(() => this.history.setQuery(query));
    });

    // The page can shrink under the reader, past the last page the paginator shows.
    effect(() => {
      const lastPage = Math.max(0, Math.ceil(this.total() / this.pageSize()) - 1);
      if (this.page() != null && untracked(this.pageIndex) > lastPage) {
        this.pageIndex.set(lastPage);
      }
    });

    this.history.loadError$
      .pipe(
        filter((e) => e != null),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((e) => {
        this.logService.error(e);
        this.toastService.showToast({
          variant: "error",
          message: this.i18nService.t("pamHistoryLoadFailed"),
        });
      });

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

  /** The rows on screen out of the server's total, in place of the page's own count. */
  protected readonly rangeLabel = ({ start, end, total }: TableRowRange) => {
    if (total === 0) {
      return this.i18nService.t("pamHistoryRequestCount", "0");
    }
    if (total === 1) {
      return this.i18nService.t("pamHistoryRequestCountSingular");
    }
    return this.i18nService.t("pamHistoryRangeOfTotal", `${start}`, `${end}`, `${total}`);
  };

  /** The clock rebuilds every row each minute; tracking by id keeps the row and its focus. */
  protected readonly trackById: TrackByFunction<HistoryTableRow> = (_index, row) => row.id;

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
    return this.page()?.cipherById.get(cipherId);
  }
}

function isHistoryStatus(value: string): value is HistoryStatus {
  return (Object.values(HistoryStatus) as string[]).includes(value);
}
