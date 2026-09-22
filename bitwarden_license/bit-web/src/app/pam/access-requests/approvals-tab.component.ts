import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Signal,
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
  TableDataSource,
  TableModule,
  TooltipDirective,
  TypographyModule,
  defineTable,
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

/** An option offered by a `bit-filter-menu` chip. */
type FilterOption = { label: string; value: string };

type ApprovalColumn = ColumnName<ApprovalRow, "window" | "actions">;
type LeaseColumn = ColumnName<ManagedLeaseRow, "window" | "actions">;

/**
 * The widths the v1 table hides its secondary columns below (Tailwind's `lg` and `xl`). The
 * component library's `isAtOrLargerThanBreakpointSignal` covers this but is not exported from
 * `@bitwarden/components`.
 */
const LG_MEDIA_QUERY = "(min-width: 1024px)";
const XL_MEDIA_QUERY = "(min-width: 1280px)";

/**
 * "Approvals" tab: requests awaiting the caller's decision, oldest first, plus the access
 * already running on the collections they manage.
 *
 * Only ever rendered for an approver — a non-approver is redirected and the tab-link is hidden.
 *
 * Data, ordering, and optimistic decide/revoke live in {@link ApproverInboxService}, and the
 * confirms and toasts in {@link ApproverActionsService}, both shared with History and the request
 * dialog; this component owns the toolbar and tables.
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

  /** Ids currently being decided, so a second click on the same row is a no-op. */
  private readonly deciding = signal<Set<string>>(new Set());

  /** Lease ids currently being revoked, for the same reason as {@link deciding}. */
  private readonly revoking = signal<Set<string>>(new Set());

  protected readonly loading = toSignal(this.inbox.loading$, { initialValue: true });

  /**
   * The skeleton is held back until the load has run for a second, per the component library's
   * display guidance, so an inbox that arrives quickly never flashes it.
   */
  protected readonly showSkeleton = toSignal(
    this.inbox.loading$.pipe(distinctUntilChanged(), skeletonLoadingDelay()),
    { initialValue: false },
  );

  /**
   * Whether a load has ever completed. Latched, since only the first load has nothing rendered
   * to leave on screen.
   */
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

  /** A single-select chip's selection, or undefined for no selection. */
  private selectedValue(chip: FilterControl | undefined): string | undefined {
    const value = chip?.value();
    return typeof value === "string" ? value : undefined;
  }

  private readonly allRows = toSignal(this.inbox.inboxRows$, { initialValue: [] as ApprovalRow[] });

  private readonly allLeases = toSignal(this.inbox.activeLeaseRows$, {
    initialValue: [] as ManagedLeaseRow[],
  });

  /** Ticks once a second so a lapsed lease stops being listed, sharing the badges' clock; torn down when there's no lease to expire. */
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
   * Leases still inside their window, checked against a live clock, not the load-time stamp
   * `activeLeaseRows$` uses, since a lease can lapse with no server push.
   *
   * Compared by identity so the per-second tick only reaches `leasesDataSource` when rows change.
   */
  private readonly liveLeases = computed(
    () => this.allLeases().filter((row) => row.endsAtMs > this.nowMs()),
    { equal: sameRows },
  );

  /** Both sections' rows before filtering — what the chip filters offer options from. */
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
   * Whether a section is empty only because the toolbar filters excluded its rows — its empty
   * copy asserts an absolute, so rendering it here would hide a still-live, still-revocable lease.
   */
  protected readonly pendingHiddenByFilters = computed(
    () => this.rows().length === 0 && this.allRows().length > 0,
  );

  protected readonly activeAccessHiddenByFilters = computed(
    () => this.leaseRows().length === 0 && this.liveLeases().length > 0,
  );

  /**
   * Whether the tab has anything at all before filtering, across both sections. Distinguishes an
   * empty inbox (nothing to do) from a filter that matched nothing (something to do, just not
   * visible), which need different copy and, for the latter, the filter controls left on screen.
   */
  protected readonly hasRows = computed(() => this.filterableRows().length > 0);

  /**
   * Whether the skeleton table is on screen. Drives the `role="status"` announcement as well, so
   * that a load finishing inside the delay never announces a screen the user was not shown.
   */
  protected readonly skeletonVisible = computed(() => this.showSkeleton() && !this.hasRows());

  /**
   * Whether the loading region replaces the tab's content. Covers the whole load before anything
   * has loaded; afterwards only the skeleton takes over, so a reload of an already-empty inbox
   * keeps its empty state up rather than blanking the tab on every managed-request change.
   */
  protected readonly loadingVisible = computed(() =>
    this.hasLoadedOnce()
      ? this.skeletonVisible()
      : (this.loading() || this.showSkeleton()) && !this.hasRows(),
  );

  /** Five fills the space the table occupies without implying a row count the inbox may not have. */
  protected readonly skeletonRows = [0, 1, 2, 3, 4];

  /**
   * Whether the current load has shown its skeleton, so removal can be announced. Held per load,
   * not for the component's life, so a retry doesn't inherit the previous attempt's skeleton.
   */
  private readonly skeletonShown = signal(false);

  /**
   * Whether the live region announces content arrival. Gated on the skeleton having shown and the
   * load having succeeded — a failed load leaves the same empty table, and a false "loaded" is
   * the one claim a sighted user can't correct against the shell's error toast.
   */
  protected readonly announceLoaded = computed(
    () => this.skeletonShown() && !this.skeletonVisible() && this.loadError() == null,
  );

  protected readonly dataSource = new TableDataSource<ApprovalRow>();
  protected readonly leasesDataSource = new TableDataSource<ManagedLeaseRow>();

  protected readonly table = defineTable<ApprovalRow, "window" | "actions">(this.rows);
  protected readonly leasesTable = defineTable<ManagedLeaseRow, "window" | "actions">(
    this.leaseRows,
  );

  private readonly atLeastLg = mediaQuerySignal(LG_MEDIA_QUERY);
  private readonly atLeastXl = mediaQuerySignal(XL_MEDIA_QUERY);

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
   * Badge state is memoised per lease so the `[state]` input keeps identity across change
   * detection, keyed off the unfiltered rows so search doesn't churn surviving badges.
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

  /**
   * The toolbar's three filters, applied to either section's rows. Both row models carry the same
   * three fields, so one predicate keeps the two sections from drifting apart.
   */
  private applyFilters<T extends FilterableRow>(rows: readonly T[]): T[] {
    const term = this.searchTerm().trim().toLowerCase();
    const collection = this.collectionFilter();
    const requester = this.requesterFilter();
    return rows.filter(
      (row) =>
        (term === "" || row.searchText.includes(term)) &&
        (collection == null || row.collectionName === collection) &&
        (requester == null || row.requester === requester),
    );
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

/** Whether the viewport matches `query`, tracking changes. Call in an injection context. */
function mediaQuerySignal(query: string): Signal<boolean> {
  const mediaQuery = typeof window === "undefined" ? undefined : window.matchMedia?.(query);
  const matches = signal(mediaQuery?.matches ?? false);
  if (mediaQuery != null) {
    const listener = (event: MediaQueryListEvent) => matches.set(event.matches);
    mediaQuery.addEventListener("change", listener);
    inject(DestroyRef).onDestroy(() => mediaQuery.removeEventListener("change", listener));
  }
  return matches.asReadonly();
}

/** Whether two row lists hold the same row objects in the same order. */
function sameRows(a: readonly ManagedLeaseRow[], b: readonly ManagedLeaseRow[]): boolean {
  return a.length === b.length && a.every((row, index) => row === b[index]);
}

/** Deduped, locale-sorted chip options from a list of possibly-blank labels. */
function distinctOptions(labels: Array<string | null>): FilterOption[] {
  const distinct = new Set(labels.filter((label): label is string => !!label));
  return [...distinct].sort((a, b) => a.localeCompare(b)).map((label) => ({ value: label, label }));
}
