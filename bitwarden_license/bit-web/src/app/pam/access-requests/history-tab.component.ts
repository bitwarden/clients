import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
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
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SyncService } from "@bitwarden/common/platform/sync";
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
  ButtonModule,
  FILTER_CONTROL,
  FilterMenuModule,
  SearchModule,
  StatusLockupComponent,
  SvgComponent,
  SkeletonComponent,
  SkeletonTextComponent,
  TableDataSource,
  TableModule,
  TypographyModule,
  defineTable,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import type { AccessLeaseId, AccessRequestId } from "../abstractions/access-lease";
import { AccessStateBadgeComponent } from "../access-state-badge/access-state-badge.component";
import { ApprovalPrivilegeService } from "../approvals/approval-privilege.service";
import { ApproverActionsService, rowBusy } from "../approvals/approver-actions.service";
import { ApproverInboxService } from "../approvals/approver-inbox.service";
import { isLiveManagedLease, isUnstartedApproval } from "../approvals/managed-lease-row";
import { DurationShortPipe } from "../date/duration-short.pipe";
import { RelativeTimePipe } from "../date/relative-time.pipe";

import { MyAccessRequestRow, resolvedOrSubmittedMs } from "./my-access-row";
import { MyAccessService } from "./my-access.service";

/** Which slice of the history the table is showing. */
const HistoryScope = Object.freeze({ All: "all", Mine: "mine", Managed: "managed" } as const);
type HistoryScope = (typeof HistoryScope)[keyof typeof HistoryScope];

function toHistoryScope(value: unknown): HistoryScope {
  return value === HistoryScope.Mine || value === HistoryScope.Managed ? value : HistoryScope.All;
}

/**
 * How long the "loaded" announcement stays in the live region, long enough to be read but not to
 * linger as a stale claim.
 */
const announcementHoldMs = 2000;

/**
 * Decided requests merged from Mine (the caller's own) and Managed (on collections they manage,
 * the only rows they can act on). The scope chip starts unset, which lists All.
 */
@Component({
  selector: "pam-history-tab",
  templateUrl: "./history-tab.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterModule,
    AccessStateBadgeComponent,
    BadgeComponent,
    BitCellComponent,
    BitCellDefDirective,
    BitCellLoadingDirective,
    BitColumnComponent,
    BitHeaderCellComponent,
    BitTableToolbarComponent,
    BitTableV2Component,
    ButtonModule,
    FilterMenuModule,
    IconComponent,
    SearchModule,
    StatusLockupComponent,
    SvgComponent,
    SkeletonComponent,
    SkeletonTextComponent,
    TableModule,
    TypographyModule,
    I18nPipe,
    DurationShortPipe,
    RelativeTimePipe,
  ],
  providers: [ApproverActionsService],
})
export class HistoryTabComponent {
  protected readonly noResultsSvg = NoResults;

  private readonly myAccess = inject(MyAccessService);
  private readonly inbox = inject(ApproverInboxService);
  private readonly approverActions = inject(ApproverActionsService);
  private readonly approvalPrivileges = inject(ApprovalPrivilegeService);
  private readonly syncService = inject(SyncService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly configService = inject(ConfigService);
  private readonly i18nService = inject(I18nService);

  // remove when VFO1 flag is removed
  protected readonly vfo1Enabled = toSignal(
    this.configService.getFeatureFlag$(FeatureFlag.VFO1Foundation),
    { initialValue: false },
  );

  protected readonly HistoryScope = HistoryScope;

  private readonly canApprove = toSignal(this.approvalPrivileges.canApprove$, {
    initialValue: false,
  });

  /**
   * `bit-filter-menu` isn't a `ControlValueAccessor`, so the chip is read through its
   * `FILTER_CONTROL` contract. On the VFO1 path the table also filters by it, but this still drives
   * {@link scope} for readers outside the table.
   */
  private readonly scopeChip = viewChild("historyScopeFilter", { read: FILTER_CONTROL });

  private readonly acting = signal<Set<string>>(new Set());

  private readonly myRows = toSignal(this.myAccess.historyRows$, {
    initialValue: [] as MyAccessRequestRow[],
  });
  private readonly managedRows = toSignal(this.inbox.historyRows$, {
    initialValue: [] as MyAccessRequestRow[],
  });
  private readonly managedIds = toSignal(this.inbox.managedIds$, {
    initialValue: new Set<string>(),
  });

  private readonly myCiphers = toSignal(this.myAccess.cipherById$, {
    initialValue: new Map<string, CipherView>(),
  });
  private readonly managedCiphers = toSignal(this.inbox.cipherById$, {
    initialValue: new Map<string, CipherView>(),
  });

  private readonly myLoadError = toSignal(this.myAccess.loadError$, { initialValue: null });
  private readonly managedLoadError = toSignal(this.inbox.loadError$, { initialValue: null });

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

  private readonly hasManagedHistory = computed(() => this.managedRows().length > 0);

  protected readonly hasHistory = computed(
    () => this.myRows().length > 0 || this.hasManagedHistory(),
  );

  /**
   * Offered to anyone who can approve once there is history to narrow. `hasManagedHistory()` also
   * covers a viewer with managed rows whom the privilege predicate doesn't recognize.
   */
  protected readonly canSwitchScope = computed(
    () => this.hasHistory() && (this.canApprove() || this.hasManagedHistory()),
  );

  /**
   * Falls back to All at once if the chip disappears while filtered. The template's `@if` destroys
   * the chip with {@link canSwitchScope}, so a returning chip starts unset and can't re-apply a
   * stale pick.
   */
  protected readonly scope = computed<HistoryScope>(() =>
    this.canSwitchScope() ? toHistoryScope(this.scopeChip()?.value()) : HistoryScope.All,
  );

  /**
   * A row both reads return keeps the caller's own copy, since only `buildMyAccessRequestRows`
   * fills in the "Extended" badge.
   */
  private readonly allRows = computed(() => {
    const rowsById = new Map(this.myRows().map((row) => [String(row.id), row]));
    for (const row of this.managedRows()) {
      const key = String(row.id);
      if (!rowsById.has(key)) {
        rowsById.set(key, row);
      }
    }
    return [...rowsById.values()].sort(
      (a, b) => resolvedOrSubmittedMs(b) - resolvedOrSubmittedMs(a),
    );
  });

  private readonly myRowIds = computed(() => new Set(this.myRows().map((row) => String(row.id))));
  private readonly managedRowIds = computed(
    () => new Set(this.managedRows().map((row) => String(row.id))),
  );

  protected readonly historyRows = computed(() => {
    switch (this.scope()) {
      case HistoryScope.Mine:
        return this.myRows();
      case HistoryScope.Managed:
        return this.managedRows();
      default:
        return this.allRows();
    }
  });

  /**
   * Shown when a listed row is actionable, by the same predicates the cells use; managed-ness alone
   * also holds for requests with nothing left to do.
   */
  protected readonly showActionsColumn = computed(() =>
    this.historyRows().some((row) => this.canRevoke(row) || this.canCancelApproval(row)),
  );

  protected readonly emptyMessageKey = computed(() =>
    this.scope() === HistoryScope.Managed ? "pamInboxHistoryEmpty" : "pamMyRequestsHistoryEmpty",
  );

  protected readonly historyDataSource = new TableDataSource<MyAccessRequestRow>();

  /**
   * The VFO1 table holds every row and narrows by scope in {@link matchesFilters}, so the scope
   * chip's option counts are drawn from the whole history rather than the slice already listed.
   */
  protected readonly historyTable = defineTable<MyAccessRequestRow, "actions">(this.allRows);

  /** The VFO1 table, for reading the term the toolbar's `bit-search` registered with it. */
  private readonly tableRef = viewChild(BitTableV2Component<MyAccessRequestRow>);

  /** The toolbar search's term, which picks the no-results state over the empty one. */
  protected readonly searchTerm = computed(() =>
    ((this.tableRef()?.filterValues() as { search?: string } | undefined)?.search ?? "")
      .trim()
      .toLowerCase(),
  );

  /** The VFO1 table's row test: the scope chip's slice, then the toolbar search within it. */
  protected readonly matchesFilters = (
    row: MyAccessRequestRow,
    values: { search?: string; historyScope?: unknown },
  ) => this.inScope(row, toHistoryScope(values.historyScope)) && this.matchesSearch(row, values);

  private inScope(row: MyAccessRequestRow, scope: HistoryScope): boolean {
    switch (scope) {
      case HistoryScope.Mine:
        return this.myRowIds().has(String(row.id));
      case HistoryScope.Managed:
        return this.managedRowIds().has(String(row.id));
      default:
        return true;
    }
  }

  /**
   * Searches the text the table shows, so a resolver named by an i18n key matches on its rendered
   * wording, not the key.
   */
  private matchesSearch(row: MyAccessRequestRow, values: { search?: string }): boolean {
    const term = (values.search ?? "").trim().toLowerCase();
    if (term === "") {
      return true;
    }
    return [
      row.cipherName ?? row.cipherId,
      row.collectionName,
      row.resolverLabelKey == null ? row.resolverName : this.i18nService.t(row.resolverLabelKey),
      row.approverComment,
    ].some((field) => field != null && field.toLowerCase().includes(term));
  }

  /** These rows are access requests, so the default "N items" count label would misname them. */
  protected readonly resultsLabel = (count: number) =>
    count === 1
      ? this.i18nService.t("oneFilterResult")
      : this.i18nService.t("filterResults", count);

  /**
   * Falls back to submitted time, or an undecided row would sink to the end of the descending sort.
   * Ascending, since `bitSortable` applies the direction itself.
   */
  protected readonly byResolvedOrSubmitted = (a: MyAccessRequestRow, b: MyAccessRequestRow) =>
    resolvedOrSubmittedMs(a) - resolvedOrSubmittedMs(b);

  /** Five rows fill the table's space without implying a real row count. */
  protected readonly skeletonRows = [0, 1, 2, 3, 4];

  constructor() {
    effect(() => {
      this.historyDataSource.data = this.historyRows();
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

  /** The decrypted cipher for a row, undefined when absent from the caller's vault. */
  protected cipherFor(cipherId: string): CipherView | undefined {
    return this.myCiphers().get(cipherId) ?? this.managedCiphers().get(cipherId);
  }

  protected isActing(row: MyAccessRequestRow): boolean {
    return this.acting().has(String(row.id));
  }

  /** Only rows on collections the caller manages can be acted on. */
  private isManaged(row: MyAccessRequestRow): boolean {
    return this.managedIds().has(String(row.id));
  }

  /**
   * A managed lease the server still reports active. Unlike Active access, it can't also test the
   * effective end, since `toRequestRow` leaves these rows no `extendedUntil`.
   */
  protected canRevoke(row: MyAccessRequestRow): boolean {
    return this.isManaged(row) && isLiveManagedLease(row);
  }

  /** An approval the requester has not started yet, so it can still be withdrawn. */
  protected canCancelApproval(row: MyAccessRequestRow): boolean {
    return this.isManaged(row) && isUnstartedApproval(row);
  }

  protected async revoke(row: MyAccessRequestRow): Promise<void> {
    if (!this.canRevoke(row) || row.producedLeaseId == null || this.isActing(row)) {
      return;
    }
    await this.approverActions.revoke(
      () => this.inbox.revokeLease(row.id, row.producedLeaseId as unknown as AccessLeaseId),
      rowBusy(this.acting, String(row.id)),
    );
  }

  protected async cancelApproval(row: MyAccessRequestRow): Promise<void> {
    if (!this.canCancelApproval(row) || this.isActing(row)) {
      return;
    }
    await this.approverActions.withdrawApproval(
      // The same expression the Item column renders, so the dialog names the item as its row does.
      row.cipherName ?? row.cipherId,
      () => this.inbox.cancelApproval(row.id as AccessRequestId),
      rowBusy(this.acting, String(row.id)),
    );
  }
}
