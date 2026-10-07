import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";
import { EMPTY, distinctUntilChanged, filter, map, switchMap } from "rxjs";

import { IconComponent } from "@bitwarden/angular/vault/components/icon.component";
import { NoResults } from "@bitwarden/assets/svg";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { skeletonLoadingDelay } from "@bitwarden/common/vault/utils/skeleton-loading.operator";
import {
  AccordionComponent,
  AccordionGroupComponent,
  BadgeComponent,
  BitCellComponent,
  BitCellDefDirective,
  BitCellLoadingDirective,
  BitColumnComponent,
  BitHeaderCellComponent,
  BitTableToolbarComponent,
  BitTableV2Component,
  ButtonModule,
  ColumnName,
  FILTER_CONTROL,
  FilterControl,
  FilterMenuComponent,
  FilterOptionComponent,
  StatusLockupComponent,
  SvgComponent,
  SearchModule,
  SkeletonComponent,
  SkeletonTextComponent,
  SortState,
  TableDataSource,
  TableModule,
  TooltipDirective,
  TypographyModule,
  defineTable,
  isAtOrLargerThanBreakpointSignal,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import type { AccessDecisionVerdict } from "../abstractions/access-lease";
import { AccessBadgeState } from "../access-state-badge/access-badge-state";
import { AccessBadgeTickerService } from "../access-state-badge/access-badge-ticker.service";
import { AccessStateBadgeComponent } from "../access-state-badge/access-state-badge.component";
import { ApprovalRow } from "../approvals/approval-row";
import { ApproverActionsService, rowBusy } from "../approvals/approver-actions.service";
import { ApproverInboxService } from "../approvals/approver-inbox.service";
import { ManagedLeaseRow } from "../approvals/managed-lease-row";
import { DurationShortPipe } from "../date/duration-short.pipe";

/** The fields the toolbar filters against, carried by both sections' row models. */
type FilterableRow = { searchText: string; collectionName: string | null; requester: string };

type ApprovalsFilter = { term: string; collection: string | null; requester: string | null };

/**
 * The toolbar's raw values by filter key, where `search` is the key the table gives a projected
 * `bit-search`. Untyped, since a chip's value is `unknown`.
 */
type ApprovalsFilterValues = { search?: unknown; collection?: unknown; requester?: unknown };

type FilterOption = { label: string; value: string };

type ApprovalColumn = ColumnName<ApprovalRow, "window" | "actions">;
type LeaseColumn = ColumnName<ManagedLeaseRow, "window" | "actions">;

/**
 * Requests awaiting the caller's decision, oldest first, plus the access running on the
 * collections they manage.
 */
@Component({
  selector: "pam-approvals-tab",
  templateUrl: "./approvals-tab.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    AccessStateBadgeComponent,
    AccordionComponent,
    AccordionGroupComponent,
    BadgeComponent,
    BitCellComponent,
    BitCellDefDirective,
    BitCellLoadingDirective,
    BitColumnComponent,
    BitHeaderCellComponent,
    BitTableToolbarComponent,
    BitTableV2Component,
    ButtonModule,
    DurationShortPipe,
    FilterMenuComponent,
    FilterOptionComponent,
    IconComponent,
    StatusLockupComponent,
    SvgComponent,
    SearchModule,
    SkeletonComponent,
    SkeletonTextComponent,
    TableModule,
    TooltipDirective,
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
  private readonly configService = inject(ConfigService);

  // remove when VFO1 flag is removed
  protected readonly vfo1Enabled = toSignal(
    this.configService.getFeatureFlag$(FeatureFlag.VFO1Foundation),
    { initialValue: false },
  );

  private readonly deciding = signal<Set<string>>(new Set());

  private readonly revoking = signal<Set<string>>(new Set());

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

  protected readonly searchControl = new FormControl<string>("", { nonNullable: true });

  private readonly searchTerm = toSignal(this.searchControl.valueChanges, { initialValue: "" });

  /**
   * `bit-filter-menu` isn't a `ControlValueAccessor`, so the chips own their selection and are
   * read through the {@link FilterControl} contract rather than a `FormControl`.
   */
  private readonly collectionFilterMenu = viewChild("collectionFilter", { read: FILTER_CONTROL });
  private readonly requesterFilterMenu = viewChild("requesterFilter", { read: FILTER_CONTROL });
  private readonly collectionFilter = computed(() =>
    this.selectedValue(this.collectionFilterMenu()),
  );
  private readonly requesterFilter = computed(() => this.selectedValue(this.requesterFilterMenu()));

  private selectedValue(chip: FilterControl | undefined): string | undefined {
    const value = chip?.value();
    return typeof value === "string" ? value : undefined;
  }

  private readonly allRows = toSignal(this.inbox.inboxRows$, { initialValue: [] as ApprovalRow[] });

  private readonly allLeases = toSignal(this.inbox.activeLeaseRows$, {
    initialValue: [] as ManagedLeaseRow[],
  });

  /** Shares the badges' clock so a lapsed lease drops off the list; idle while there are none. */
  private readonly nowMs = toSignal(
    toObservable(computed(() => this.allLeases().length > 0)).pipe(
      switchMap((anyLeases) => (anyLeases ? this.ticker.ticks$ : EMPTY)),
    ),
    { initialValue: Date.now() },
  );

  private readonly cipherById = toSignal(this.inbox.cipherById$, {
    initialValue: new Map<string, CipherView>(),
  });

  /**
   * Leases still inside their window by a live clock, since one can lapse with no push. Compared
   * by identity so the tick only reaches `leasesDataSource` when rows change.
   */
  private readonly liveLeases = computed(
    () => this.allLeases().filter((row) => row.endsAtMs > this.nowMs()),
    { equal: sameRows },
  );

  /** Both sections' rows before filtering, which the chips build their options from. */
  private readonly filterableRows = computed<FilterableRow[]>(() => [
    ...this.allRows(),
    ...this.liveLeases(),
  ]);

  /** Every distinct collection present on the tab, for the Collection filter. */
  protected readonly collectionOptions = computed<FilterOption[]>(() =>
    distinctOptions(this.filterableRows().map((row) => row.collectionName)),
  );

  /** Every distinct requester present on the tab, for the Requester filter. */
  protected readonly requesterOptions = computed<FilterOption[]>(() =>
    distinctOptions(this.filterableRows().map((row) => row.requester)),
  );

  protected readonly rows = computed(() => this.applyFilters(this.allRows()));

  protected readonly leaseRows = computed(() => this.applyFilters(this.liveLeases()));

  /**
   * True when a section is empty only because the filters excluded its rows, where the usual empty
   * copy would deny that a still-revocable lease exists.
   */
  protected readonly pendingHiddenByFilters = computed(
    () => this.rows().length === 0 && this.allRows().length > 0,
  );

  protected readonly activeAccessHiddenByFilters = computed(
    () => this.leaseRows().length === 0 && this.liveLeases().length > 0,
  );

  /**
   * Whether either section has rows before filtering, which separates an empty inbox from a filter
   * that matched nothing; the latter keeps the filter controls on screen.
   */
  protected readonly hasRows = computed(() => this.filterableRows().length > 0);

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

  /** Five rows fill the table's space without implying a real row count. */
  protected readonly skeletonRows = [0, 1, 2, 3, 4];

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

  protected readonly dataSource = new TableDataSource<ApprovalRow>();
  protected readonly leasesDataSource = new TableDataSource<ManagedLeaseRow>();

  /**
   * Fed the unfiltered inbox, since the projected toolbar registers with this table and it filters
   * through {@link rowMatchesFilter}. Pre-filtered rows would filter twice and skew each chip's
   * counts.
   */
  protected readonly table = defineTable<ApprovalRow, "window" | "actions">(this.allRows);

  /**
   * Seeded here rather than by the column's `defaultSort`, which bit-table-v2 reads once from the
   * displayed columns, so opening below lg would leave the table unsorted.
   */
  protected readonly pendingSort = signal<SortState<ApprovalColumn>>({
    column: "submittedAtMs",
    direction: "asc",
  });
  protected readonly leasesTable = defineTable<ManagedLeaseRow, "window" | "actions">(
    this.leaseRows,
  );

  private readonly atLeastLg = isAtOrLargerThanBreakpointSignal("lg");
  private readonly atLeastXl = isAtOrLargerThanBreakpointSignal("xl");

  /**
   * A v2 column is a grid track, so a breakpoint class on its cells would leave an empty track
   * behind; the narrow-viewport hiding v1 does with `tw-hidden` is done by omission instead.
   */
  protected readonly displayedColumns = computed<ApprovalColumn[]>(() => [
    "cipherName",
    "requester",
    ...(this.atLeastXl() ? (["window", "reason"] as const) : []),
    ...(this.atLeastLg() ? (["submittedAtMs"] as const) : []),
    "actions",
  ]);

  protected readonly leaseDisplayedColumns = computed<LeaseColumn[]>(() => [
    "cipherName",
    "requester",
    ...(this.atLeastXl() ? (["window"] as const) : []),
    "endsAtMs",
    "actions",
  ]);

  /**
   * Memoised per lease so each badge's input keeps its identity, and keyed off the unfiltered rows
   * so a search doesn't churn the remaining badges.
   */
  private readonly leaseBadgeStates = computed(
    () =>
      new Map<string, AccessBadgeState>(
        this.allLeases().map((row) => [
          String(row.leaseId),
          { kind: "active", expiresAt: new Date(row.endsAt) },
        ]),
      ),
  );

  constructor() {
    effect(() => {
      this.dataSource.data = this.rows();
    });
    effect(() => {
      this.leasesDataSource.data = this.leaseRows();
    });
    effect(() => {
      if (this.skeletonVisible()) {
        this.skeletonShown.set(true);
      } else if (this.loading()) {
        this.skeletonShown.set(false);
      }
    });
  }

  private readonly filterInputs = computed<ApprovalsFilter>(() => ({
    term: this.searchTerm().trim().toLowerCase(),
    collection: this.collectionFilter() ?? null,
    requester: this.requesterFilter() ?? null,
  }));

  /**
   * The Pending table's row test. Its toolbar's values arrive as `values` rather than through
   * {@link filterInputs}, since that keyed shape lets the table count each chip's options.
   */
  protected readonly rowMatchesFilter = (
    row: ApprovalRow,
    values: ApprovalsFilterValues,
  ): boolean => matchesFilter(row, toApprovalsFilter(values));

  /**
   * Both row models carry the three filtered fields, so one predicate keeps the sections from
   * drifting apart.
   */
  private applyFilters<T extends FilterableRow>(rows: readonly T[]): T[] {
    const filter = this.filterInputs();
    return rows.filter((row) => matchesFilter(row, filter));
  }

  protected cipherFor(cipherId: string): CipherView | undefined {
    return this.cipherById().get(cipherId);
  }

  protected leaseBadgeState(id: ManagedLeaseRow["leaseId"]): AccessBadgeState | null {
    return this.leaseBadgeStates().get(String(id)) ?? null;
  }

  protected isDeciding(row: ApprovalRow): boolean {
    return this.deciding().has(String(row.id));
  }

  protected isRevoking(row: ManagedLeaseRow): boolean {
    return this.revoking().has(String(row.leaseId));
  }

  protected async decide(row: ApprovalRow, verdict: AccessDecisionVerdict): Promise<void> {
    if (!row.canDecide || this.isDeciding(row)) {
      return;
    }
    await this.approverActions.decide(
      { verdict, row, cipher: this.cipherFor(row.cipherId) },
      (decided, comment) => this.inbox.decide(row.id, decided, comment),
      rowBusy(this.deciding, String(row.id)),
    );
  }

  protected async revoke(row: ManagedLeaseRow): Promise<void> {
    if (this.isRevoking(row)) {
      return;
    }
    await this.approverActions.revoke(
      () => this.inbox.revokeLease(row.requestId, row.leaseId),
      rowBusy(this.revoking, String(row.leaseId)),
    );
  }
}

function matchesFilter(row: FilterableRow, filter: ApprovalsFilter): boolean {
  return (
    (filter.term === "" || row.searchText.includes(filter.term)) &&
    (filter.collection == null || row.collectionName === filter.collection) &&
    (filter.requester == null || row.requester === filter.requester)
  );
}

function toApprovalsFilter(values: ApprovalsFilterValues): ApprovalsFilter {
  return {
    term: typeof values.search === "string" ? values.search.trim().toLowerCase() : "",
    collection: typeof values.collection === "string" ? values.collection : null,
    requester: typeof values.requester === "string" ? values.requester : null,
  };
}

function sameRows(a: readonly ManagedLeaseRow[], b: readonly ManagedLeaseRow[]): boolean {
  return a.length === b.length && a.every((row, index) => row === b[index]);
}

function distinctOptions(labels: Array<string | null>): FilterOption[] {
  const distinct = new Set(labels.filter((label): label is string => !!label));
  return [...distinct].sort((a, b) => a.localeCompare(b)).map((label) => ({ value: label, label }));
}
