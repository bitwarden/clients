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
import { takeUntilDestroyed, toObservable, toSignal } from "@angular/core/rxjs-interop";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";
import { EMPTY, filter, map, shareReplay, startWith, switchMap, take } from "rxjs";

import { IconComponent } from "@bitwarden/angular/vault/components/icon.component";
import { NoResults } from "@bitwarden/assets/svg";
import {
  AccessLeaseId,
  AccessRequestId,
  activateAccessErrorMessageKey,
  AccessBadgeState,
  selectedFilterStrings,
} from "@bitwarden/bit-pam";
import {
  AccessBadgeTickerService,
  AccessStateBadgeComponent,
  DurationCompoundPipe,
  DurationShortPipe,
  RequestedWindowPipe,
  TimestampPipe,
} from "@bitwarden/bit-pam-components";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { skeletonLoadingDelay } from "@bitwarden/common/vault/utils/skeleton-loading.operator";
import {
  BadgeComponent,
  BitCellComponent,
  BitCellDefDirective,
  BitCellLoadingDirective,
  BitColumnComponent,
  BitHeaderCellComponent,
  BitTableToolbarComponent,
  BitTableV2Component,
  DialogService,
  FilterMenuComponent,
  FilterOptionComponent,
  IconComponent as BitIconComponent,
  HoverRevealDirective,
  IconButtonModule,
  IconTileOptions,
  SearchModule,
  SkeletonComponent,
  SkeletonTextComponent,
  SortFn,
  StatusLockupComponent,
  SvgComponent,
  ToastService,
  TypographyModule,
  defineTable,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { announcementHoldMs } from "./announcement-hold";
import {
  MyAccessLeaseRow,
  MyAccessRequestRow,
  isRedeemableGrant,
  lapsedGrantBadge,
} from "./my-access-row";
import { MyAccessService } from "./my-access.service";
import {
  MY_REQUEST_LOOK,
  MY_REQUEST_STATUSES,
  MyRequestRow,
  MyRequestStatus,
  buildMyRequestRows,
  myRequestStatus,
  myRequestStatusRank,
} from "./my-request-row";

type FilterOption = { label: string; value: string; iconTile?: IconTileOptions };

type FilterableRow = {
  collectionId: string;
  cipherName: string | null;
  collectionName: string | null;
};

/**
 * The toolbar's raw values by filter key, where `search` is the key the table gives a projected
 * `bit-search`. Untyped, since a chip's value is `unknown`.
 */
type MyRequestsFilterValues = { search?: unknown; collection?: unknown; status?: unknown };

/**
 * The caller's own access in one table: undecided requests, unactivated grants and held leases,
 * each row carrying the status that decides what can be done with it.
 */
@Component({
  selector: "pam-my-requests-tab",
  templateUrl: "./my-requests-tab.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterModule,
    AccessStateBadgeComponent,
    SkeletonComponent,
    SkeletonTextComponent,
    StatusLockupComponent,
    SvgComponent,
    BadgeComponent,
    BitCellComponent,
    BitCellDefDirective,
    BitCellLoadingDirective,
    BitColumnComponent,
    BitHeaderCellComponent,
    BitTableToolbarComponent,
    BitTableV2Component,
    FilterMenuComponent,
    FilterOptionComponent,
    BitIconComponent,
    HoverRevealDirective,
    IconButtonModule,
    IconComponent,
    SearchModule,
    TypographyModule,
    I18nPipe,
    TimestampPipe,
    DurationCompoundPipe,
    DurationShortPipe,
    RequestedWindowPipe,
  ],
})
export class MyRequestsTabComponent {
  private readonly myAccess = inject(MyAccessService);
  private readonly i18nService = inject(I18nService);
  private readonly toastService = inject(ToastService);
  private readonly logService = inject(LogService);
  private readonly dialogService = inject(DialogService);
  private readonly ticker = inject(AccessBadgeTickerService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly cancelling = signal<Set<AccessRequestId>>(new Set());
  protected readonly starting = signal<Set<AccessRequestId>>(new Set());
  protected readonly ending = signal<Set<AccessLeaseId>>(new Set());

  /** Free-text search across item and collection names. */
  protected readonly searchControl = new FormControl<string>("", { nonNullable: true });

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
   * Latched on the first complete load, so a background reload can't pull the table from under a
   * reader. Until it raises, the tab renders neither empty state, "you have no requests" is not
   * something an unfinished read can say.
   */
  private readonly loaded$ = this.myAccess.loading$.pipe(
    filter((loading) => !loading),
    take(1),
    map(() => true),
    startWith(false),
    takeUntilDestroyed(this.destroyRef),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  protected readonly loaded = toSignal(this.loaded$, { initialValue: false });

  /** Held back for a second of loading, so a quick read never flashes the skeleton. */
  private readonly showSkeleton = toSignal(
    this.loaded$.pipe(
      map((isLoaded) => !isLoaded),
      skeletonLoadingDelay(),
    ),
    { initialValue: false },
  );

  protected readonly skeletonVisible = computed(() => this.showSkeleton() && !this.loaded());

  /** Raised once the skeleton shows, so its removal can be announced; lowered after the hold. */
  private readonly skeletonShown = signal(false);

  private readonly loadFailed = toSignal(
    this.myAccess.loadError$.pipe(map((error) => error != null)),
    { initialValue: false },
  );

  /**
   * Announced only after a shown skeleton and a read that landed: a failure leaves the same empty
   * table, and "loaded" would contradict the shell's error toast.
   */
  protected readonly announceLoaded = computed(
    () => this.skeletonShown() && !this.skeletonVisible() && !this.loadFailed(),
  );

  /** Five rows fill the table's space without implying a real row count. */
  protected readonly skeletonRows = [0, 1, 2, 3, 4];

  protected readonly noResultsSvg = NoResults;

  protected readonly nowMs = toSignal(
    toObservable(computed(() => this.myRequestRows().length > 0)).pipe(
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
   * The chip's own counts, over every row the tab holds. Counted without the search term, so a
   * chip reads the same whether or not something is typed in the search box.
   */
  protected readonly collectionCounts = computed<ReadonlyMap<string, number>>(() => {
    const counts = new Map<string, number>();
    for (const row of [...this.allPending(), ...this.allExtensions(), ...this.allLeases()]) {
      counts.set(row.collectionId, (counts.get(row.collectionId) ?? 0) + 1);
    }
    return counts;
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

  protected readonly myRequestRows = computed<MyRequestRow[]>(() =>
    buildMyRequestRows(this.allLeases(), this.allPending(), this.allExtensions()),
  );

  /** Whether the tab holds anything at all, before any filter narrows it. */
  protected readonly hasRows = computed(() => this.myRequestRows().length > 0);

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

  protected readonly statusOptions = computed<FilterOption[]>(() =>
    MY_REQUEST_STATUSES.map((status) => ({
      value: status,
      label: this.i18nService.t(MY_REQUEST_LOOK[status].labelKey),
      iconTile: MY_REQUEST_LOOK[status].tile,
    })),
  );

  protected readonly statusCounts = computed<ReadonlyMap<string, number>>(() => {
    const counts = new Map<string, number>(MY_REQUEST_STATUSES.map((status) => [status, 0]));
    for (const row of this.myRequestRows()) {
      const status = this.rowStatus(row);
      counts.set(status, (counts.get(status) ?? 0) + 1);
    }
    return counts;
  });

  protected readonly noCollectionOptions = computed(() => this.collectionOptions().length === 0);

  protected readonly byStatus: SortFn = (a: MyRequestRow, b: MyRequestRow): number =>
    myRequestStatusRank(this.rowStatus(a)) - myRequestStatusRank(this.rowStatus(b));

  /**
   * `window` is a synthetic column, so there is no property for the table to sort on: without a
   * comparator every row reads `undefined` and the header sorts nothing. Orders by when the
   * window opens, as the Approvals tab does.
   */
  protected readonly byWindow: SortFn = (a: MyRequestRow, b: MyRequestRow): number =>
    Date.parse(a.notBefore) - Date.parse(b.notBefore);

  protected readonly myRequestsTable = defineTable<MyRequestRow, "window" | "status" | "actions">(
    this.myRequestRows,
  );

  protected rowStatus(row: MyRequestRow): MyRequestStatus {
    return myRequestStatus(row, this.nowMs());
  }

  protected readonly myRequestMatchesFilter = (
    row: MyRequestRow,
    values: MyRequestsFilterValues,
  ): boolean => {
    const statuses = selectedFilterStrings(values.status);
    if (statuses.length > 0 && !statuses.includes(this.rowStatus(row))) {
      return false;
    }
    const collections = selectedFilterStrings(values.collection);
    if (collections.length > 0 && !collections.includes(row.collectionId)) {
      return false;
    }
    return matchesTerm(row, searchTerm(values));
  };

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

  /** The server refuses to activate before the window opens, so Start waits for it. */
  protected hasOpened(notBefore: string): boolean {
    return Date.parse(notBefore) <= this.nowMs();
  }

  /** A lapsed grant can no longer be started, so Cancel is withheld like Start until it expires. */
  protected canCancel(row: MyAccessRequestRow): boolean {
    if (row.status === "pending") {
      return true;
    }
    return isRedeemableGrant(row, this.nowMs());
  }

  protected canStart(row: MyAccessRequestRow): boolean {
    return isRedeemableGrant(row, this.nowMs()) && this.hasOpened(row.leaseNotBefore);
  }

  protected badgesReady(row: MyAccessRequestRow): boolean {
    return isRedeemableGrant(row, this.nowMs());
  }

  protected readonly lapsedGrantBadge = lapsedGrantBadge;

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

function searchTerm(values: MyRequestsFilterValues): string {
  return typeof values.search === "string" ? values.search.trim().toLowerCase() : "";
}

function matchesTerm(row: FilterableRow, term: string): boolean {
  if (term === "") {
    return true;
  }
  return `${row.cipherName ?? ""} ${row.collectionName ?? ""}`.toLowerCase().includes(term);
}
