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
import { EMPTY, switchMap } from "rxjs";

import { IconComponent } from "@bitwarden/angular/vault/components/icon.component";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  AccordionComponent,
  AccordionGroupComponent,
  BadgeComponent,
  BitCellComponent,
  BitCellDefDirective,
  BitColumnComponent,
  BitHeaderCellComponent,
  BitTableToolbarComponent,
  BitTableV2Component,
  ButtonModule,
  DialogService,
  FILTER_CONTROL,
  FilterControl,
  FilterMenuComponent,
  FilterOptionComponent,
  SearchModule,
  SortDirection,
  SortFn,
  TableDataSource,
  TableModule,
  ToastService,
  TypographyModule,
  defineTable,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { AccessLeaseId, AccessRequestId, activateAccessErrorMessageKey } from "..";
import { AccessBadgeState } from "../access-state-badge/access-badge-state";
import { AccessBadgeTickerService } from "../access-state-badge/access-badge-ticker.service";
import { AccessStateBadgeComponent } from "../access-state-badge/access-state-badge.component";
import { DurationShortPipe } from "../date/duration-short.pipe";
import { RemainingTimePipe } from "../date/remaining-time.pipe";

import {
  MyAccessLeaseRow,
  MyAccessRequestRow,
  TerminalStatusBadge,
  isRedeemableGrant,
  lapsedGrantBadge,
} from "./my-access-row";
import { MyAccessService } from "./my-access.service";

type FilterOption = { label: string; value: string };

type FilterableRow = {
  collectionId: string;
  cipherName: string | null;
  collectionName: string | null;
};

type MyRequestsFilter = { term: string; collection: string | null };

/**
 * The toolbar's raw values by filter key, where `search` is the key the table gives a projected
 * `bit-search`. Untyped, since a chip's value is `unknown`.
 */
type MyRequestsFilterValues = { search?: unknown; collection?: unknown };

/**
 * A row of the active-access table; exactly one of `lease` and `request` is set. `cipherName` and
 * `notAfter` are flattened because `bit-table` sorts on top-level properties.
 */
type ActiveAccessRow = {
  readonly testId: string;
  readonly requestId: AccessRequestId;
  readonly cipherId: string;
  readonly cipherName: string | null;
  readonly collectionName: string | null;
  readonly notBefore: string;
  readonly notAfter: string;
  readonly lease: MyAccessLeaseRow | null;
  readonly request: MyAccessRequestRow | null;
};

/** Ascending by window end; meaningful only within one row kind. */
const byWindowEnd = (a: ActiveAccessRow, b: ActiveAccessRow): number =>
  Date.parse(a.notAfter) - Date.parse(b.notAfter);

/**
 * The caller's own access in three sections: Pending, Extension requests, and Active access, which
 * holds leases and unactivated grants.
 */
@Component({
  selector: "pam-my-requests-tab",
  templateUrl: "./my-requests-tab.component.html",
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
    BitColumnComponent,
    BitHeaderCellComponent,
    BitTableToolbarComponent,
    BitTableV2Component,
    ButtonModule,
    FilterMenuComponent,
    FilterOptionComponent,
    IconComponent,
    SearchModule,
    TableModule,
    TypographyModule,
    I18nPipe,
    DurationShortPipe,
    RemainingTimePipe,
  ],
})
export class MyRequestsTabComponent {
  private readonly myAccess = inject(MyAccessService);
  private readonly i18nService = inject(I18nService);
  private readonly toastService = inject(ToastService);
  private readonly logService = inject(LogService);
  private readonly dialogService = inject(DialogService);
  private readonly ticker = inject(AccessBadgeTickerService);
  private readonly configService = inject(ConfigService);

  // remove when VFO1 flag is removed
  protected readonly vfo1Enabled = toSignal(
    this.configService.getFeatureFlag$(FeatureFlag.VFO1Foundation),
    { initialValue: false },
  );

  protected readonly cancelling = signal<Set<AccessRequestId>>(new Set());
  protected readonly starting = signal<Set<AccessRequestId>>(new Set());
  protected readonly ending = signal<Set<AccessLeaseId>>(new Set());

  /** Free-text search across item and collection names. */
  protected readonly searchControl = new FormControl<string>("", { nonNullable: true });

  private readonly searchTerm = toSignal(this.searchControl.valueChanges, { initialValue: "" });

  /**
   * `bit-filter-menu` isn't a `ControlValueAccessor`, so the chip owns its selection and is
   * read through the {@link FilterControl} contract rather than a `FormControl`.
   */
  private readonly collectionFilter = viewChild("collectionFilter", { read: FILTER_CONTROL });
  private readonly selectedCollection = computed(() => this.selectedValue(this.collectionFilter()));

  private selectedValue(chip: FilterControl | undefined): string | undefined {
    const value = chip?.value();
    return typeof value === "string" ? value : undefined;
  }

  private readonly allPending = toSignal(this.myAccess.pendingRows$, {
    initialValue: [] as MyAccessRequestRow[],
  });
  private readonly allExtensions = toSignal(this.myAccess.extensionRows$, {
    initialValue: [] as MyAccessRequestRow[],
  });
  private readonly allLeases = toSignal(this.myAccess.leases$, {
    initialValue: [] as MyAccessLeaseRow[],
  });

  /**
   * Shares the badges' clock, idle while no request is listed since lease badges run their own
   * countdown. Gated on the unfiltered requests, not anything downstream of the clock, to avoid
   * feedback.
   */
  protected readonly nowMs = toSignal(
    toObservable(computed(() => this.allPending().length > 0)).pipe(
      switchMap((anyRequests) => (anyRequests ? this.ticker.ticks$ : EMPTY)),
    ),
    { initialValue: Date.now() },
  );

  private readonly cipherById = toSignal(this.myAccess.cipherById$, {
    initialValue: new Map<string, CipherView>(),
  });

  /** Every distinct collection present across the caller's rows, for the Collection filter. */
  protected readonly collectionOptions = computed<FilterOption[]>(() => {
    const byId = new Map<string, string>();
    for (const row of [...this.allPending(), ...this.allExtensions(), ...this.allLeases()]) {
      if (row.collectionName != null && !byId.has(row.collectionId)) {
        byId.set(row.collectionId, row.collectionName);
      }
    }
    return [...byId.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  });

  /**
   * Overrides the host Pending table's option counts, which see only pending rows, since the chip
   * narrows all three sections. Counted without the search term, like the host's absolute counts.
   */
  protected readonly collectionCounts = computed<ReadonlyMap<string, number>>(() => {
    const counts = new Map<string, number>();
    for (const row of [...this.allPending(), ...this.allExtensions(), ...this.allLeases()]) {
      counts.set(row.collectionId, (counts.get(row.collectionId) ?? 0) + 1);
    }
    return counts;
  });

  private readonly filteredPending = computed(() => this.applyFilters(this.allPending()));

  private readonly allPendingRows = computed(() =>
    this.allPending().filter((row) => row.status === "pending"),
  );

  /** Only rows still awaiting a decision; approved grants go to Active access. */
  protected readonly pendingRows = computed(() =>
    this.filteredPending().filter((row) => row.status === "pending"),
  );

  /**
   * Approved and awaiting activation. Split from {@link pendingRows} on `status` alone, since a
   * clock-dependent split would drop a lapsed grant from both sections.
   */
  private readonly approvedRows = computed(() =>
    this.filteredPending().filter((row) => row.status !== "pending"),
  );

  protected readonly extensionRows = computed(() => this.applyFilters(this.allExtensions()));
  private readonly leases = computed(() => this.applyFilters(this.allLeases()));

  /**
   * Never reads `nowMs()`, since a per-tick rebuild would restart every badge's countdown. Leases
   * come first, and Window isn't sortable because `notAfter` is a lease's end but a grant's
   * activation deadline.
   */
  protected readonly activeAccessRows = computed<ActiveAccessRow[]>(() => {
    const held: ActiveAccessRow[] = this.leases().map((lease): ActiveAccessRow => ({
      testId: `my-access-lease-${lease.id}`,
      requestId: lease.requestId,
      cipherId: lease.cipherId,
      cipherName: lease.cipherName,
      collectionName: lease.collectionName,
      notBefore: lease.notBefore,
      notAfter: lease.notAfter,
      lease,
      request: null,
    }));
    const granted: ActiveAccessRow[] = this.approvedRows().map((request): ActiveAccessRow => ({
      testId: `my-access-approved-${request.id}`,
      requestId: request.id,
      cipherId: request.cipherId,
      cipherName: request.cipherName,
      collectionName: request.collectionName,
      notBefore: request.leaseNotBefore,
      notAfter: request.leaseNotAfter,
      lease: null,
      request,
    }));
    return [...held.sort(byWindowEnd), ...granted.sort(byWindowEnd)];
  });

  /**
   * Memoised per lease, since a fresh state object each tick would restart the badge's countdown.
   * Keyed off the unfiltered rows so a search doesn't churn the remaining badges.
   */
  private readonly leaseBadgeStates = computed(
    () =>
      new Map<AccessLeaseId, AccessBadgeState>(
        this.allLeases().map((lease) => [
          lease.id,
          { kind: "active", expiresAt: new Date(lease.notAfter) },
        ]),
      ),
  );

  /** One shared instance so the badge input stays stable. */
  protected readonly readyBadge: AccessBadgeState = { kind: "ready" };

  /**
   * `bit-table` multiplies a custom comparator by its direction, so the held-first term is
   * pre-multiplied to hold in both directions; the item name decides within a group.
   */
  protected readonly byItemName: SortFn = (
    a: ActiveAccessRow,
    b: ActiveAccessRow,
    direction?: SortDirection,
  ): number => {
    const grouping = (a.lease == null ? 1 : 0) - (b.lease == null ? 1 : 0);
    if (grouping !== 0) {
      return direction === "desc" ? -grouping : grouping;
    }
    return (a.cipherName ?? "").localeCompare(b.cipherName ?? "");
  };

  /**
   * Each table renders from its own data source so `bit-table` can sort the rows independently.
   */
  protected readonly pendingDataSource = new TableDataSource<MyAccessRequestRow>();
  protected readonly extensionDataSource = new TableDataSource<MyAccessRequestRow>();
  protected readonly activeAccessDataSource = new TableDataSource<ActiveAccessRow>();

  /**
   * Fed the unfiltered pending rows, since the projected toolbar registers with this table and it
   * filters through {@link rowMatchesFilter}. Pre-filtered rows would filter twice and skew the
   * chip's counts.
   */
  protected readonly pendingTable = defineTable<MyAccessRequestRow, "window" | "actions">(
    this.allPendingRows,
  );
  protected readonly extensionTable = defineTable<MyAccessRequestRow, "window" | "actions">(
    this.extensionRows,
  );
  protected readonly activeAccessTable = defineTable<
    ActiveAccessRow,
    "window" | "status" | "actions"
  >(this.activeAccessRows);

  constructor() {
    effect(() => {
      this.pendingDataSource.data = this.pendingRows();
    });
    effect(() => {
      this.extensionDataSource.data = this.extensionRows();
    });
    effect(() => {
      this.activeAccessDataSource.data = this.activeAccessRows();
    });
  }

  private readonly filterInputs = computed<MyRequestsFilter>(() => ({
    term: this.searchTerm().trim().toLowerCase(),
    collection: this.selectedCollection() ?? null,
  }));

  /**
   * The Pending table's row test. Its toolbar's values arrive as `values` rather than through
   * {@link filterInputs}, since that keyed shape lets the table count the chip's options.
   */
  protected readonly rowMatchesFilter = (
    row: MyAccessRequestRow,
    values: MyRequestsFilterValues,
  ): boolean => matchesFilter(row, toMyRequestsFilter(values));

  /** Filters every section but Pending, which the table hosting the toolbar narrows. */
  private applyFilters<T extends FilterableRow>(rows: T[]): T[] {
    const filter = this.filterInputs();
    return rows.filter((row) => matchesFilter(row, filter));
  }

  /** Undefined when absent from the caller's vault, in which case no favicon renders. */
  protected cipherFor(cipherId: string): CipherView | undefined {
    return this.cipherById().get(cipherId);
  }

  protected leaseBadgeState(id: AccessLeaseId): AccessBadgeState | null {
    return this.leaseBadgeStates().get(id) ?? null;
  }

  protected isCancelling(id: AccessRequestId): boolean {
    return this.cancelling().has(id);
  }

  protected isStarting(id: AccessRequestId): boolean {
    return this.starting().has(id);
  }

  protected isEnding(id: AccessLeaseId): boolean {
    return this.ending().has(id);
  }

  /** An opened window renders as "until X" instead of a from-to range. */
  protected startsNow(row: Pick<MyAccessRequestRow, "leaseNotBefore">): boolean {
    return Date.parse(row.leaseNotBefore) <= this.nowMs();
  }

  /** A lapsed grant can no longer be started, so Cancel is withheld like Start until it expires. */
  protected canCancel(row: MyAccessRequestRow): boolean {
    if (row.status === "pending") {
      return true;
    }
    return isRedeemableGrant(row, this.nowMs());
  }

  /** Past the window the server rejects activation, so Start is not offered. */
  protected canStart(row: MyAccessRequestRow): boolean {
    return isRedeemableGrant(row, this.nowMs());
  }

  /** Startable and inside its window, the only time "Ready to use" is true. */
  protected isReadyNow(row: MyAccessRequestRow): boolean {
    return this.canStart(row) && this.startsNow(row);
  }

  /**
   * A lapsed grant shares a section with the access the caller holds, so it must not keep the green
   * "Approved".
   */
  protected grantBadge(row: MyAccessRequestRow): TerminalStatusBadge | null {
    return this.canStart(row) ? row.statusBadge : lapsedGrantBadge;
  }

  protected async cancel(row: MyAccessRequestRow): Promise<void> {
    if (!this.canCancel(row) || this.isCancelling(row.id)) {
      return;
    }
    this.cancelling.update((s) => new Set([...s, row.id]));
    try {
      await this.myAccess.cancel(row.id);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamMyRequestsCanceledToast"),
      });
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("pamMyRequestsCancelError"),
      });
    } finally {
      this.cancelling.update((s) => {
        const next = new Set(s);
        next.delete(row.id);
        return next;
      });
    }
  }

  protected async activate(row: MyAccessRequestRow): Promise<void> {
    if (!this.canStart(row) || this.isStarting(row.id)) {
      return;
    }
    this.starting.update((s) => new Set([...s, row.id]));
    try {
      await this.myAccess.activate(row.id);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamStartLeaseSuccess"),
      });
    } catch (e) {
      this.logService.error(e);
      // A refusal (e.g. another active lease on the item) leaves the request activatable for a
      // retry.
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t(activateAccessErrorMessageKey(e)),
      });
    } finally {
      this.starting.update((s) => {
        const next = new Set(s);
        next.delete(row.id);
        return next;
      });
    }
  }

  /** Ends the caller's own lease early, which records it as canceled, not revoked. */
  protected async endLease(lease: MyAccessLeaseRow): Promise<void> {
    if (this.isEnding(lease.id)) {
      return;
    }
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "pamEndLeaseTitle" },
      content: { key: "pamEndLeaseConfirm" },
      acceptButtonText: { key: "pamEndLeaseButton" },
      type: "warning",
    });
    if (!confirmed) {
      return;
    }
    this.ending.update((s) => new Set([...s, lease.id]));
    try {
      await this.myAccess.endLease(lease.id);
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("pamEndLeaseSuccess"),
      });
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("errorOccurred"),
      });
    } finally {
      this.ending.update((s) => {
        const next = new Set(s);
        next.delete(lease.id);
        return next;
      });
    }
  }
}

function matchesFilter(row: FilterableRow, filter: MyRequestsFilter): boolean {
  if (filter.collection != null && row.collectionId !== filter.collection) {
    return false;
  }
  if (filter.term === "") {
    return true;
  }
  const haystack = `${row.cipherName ?? ""} ${row.collectionName ?? ""}`.toLowerCase();
  return haystack.includes(filter.term);
}

function toMyRequestsFilter(values: MyRequestsFilterValues): MyRequestsFilter {
  return {
    term: typeof values.search === "string" ? values.search.trim().toLowerCase() : "",
    collection: typeof values.collection === "string" ? values.collection : null,
  };
}
