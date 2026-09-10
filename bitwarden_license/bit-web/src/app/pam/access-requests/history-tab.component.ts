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
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { skeletonLoadingDelay } from "@bitwarden/common/vault/utils/skeleton-loading.operator";
import {
  BadgeComponent,
  ButtonModule,
  DialogService,
  FILTER_CONTROL,
  FilterMenuModule,
  StatusLockupComponent,
  SvgComponent,
  SkeletonComponent,
  SkeletonTextComponent,
  TableDataSource,
  TableModule,
  ToastService,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import type { AccessLeaseId, AccessRequestId } from "../abstractions/access-lease";
import { AccessStateBadgeComponent } from "../access-state-badge/access-state-badge.component";
import { ApprovalPrivilegeService } from "../approvals/approval-privilege.service";
import { ApproverInboxService } from "../approvals/approver-inbox.service";
import { isLiveManagedLease } from "../approvals/managed-lease-row";
import { DurationShortPipe } from "../date/duration-short.pipe";
import { RelativeTimePipe } from "../date/relative-time.pipe";

import { MyAccessRequestRow, resolvedOrSubmittedMs } from "./my-access-row";
import { MyAccessService } from "./my-access.service";

/** Which slice of the history the table is showing. */
const HistoryScope = Object.freeze({ All: "all", Mine: "mine", Managed: "managed" } as const);
type HistoryScope = (typeof HistoryScope)[keyof typeof HistoryScope];

/**
 * How long the "loaded" announcement is left in the live region. Long enough for a polite
 * announcement to be taken, short enough that what is left behind is the empty region rather than a
 * stale claim about a load.
 */
const announcementHoldMs = 2000;

/**
 * "History" tab: decided requests merged from Mine (the caller's own terminal requests) and
 * Managed (decided requests for collections the caller manages, the only ones they can undo a
 * decision on).
 *
 * Opens on All so the reader is never shown an empty table behind an unpressed chip;
 * `managedIds` is the per-row authority, so a row the caller both raised and manages appears
 * once, keeping the richer copy.
 *
 * A caller with no approval privilege has no managed rows, no Actions column, and no chip.
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
    ButtonModule,
    FilterMenuModule,
    IconComponent,
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
})
export class HistoryTabComponent {
  protected readonly noResultsSvg = NoResults;

  private readonly myAccess = inject(MyAccessService);
  private readonly inbox = inject(ApproverInboxService);
  private readonly dialogService = inject(DialogService);
  private readonly toastService = inject(ToastService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);
  private readonly approvalPrivileges = inject(ApprovalPrivilegeService);
  private readonly syncService = inject(SyncService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly HistoryScope = HistoryScope;

  private readonly canApprove = toSignal(this.approvalPrivileges.canApprove$, {
    initialValue: false,
  });

  /**
   * `bit-filter-menu` is not a `ControlValueAccessor`, so its selection is read off the chip's own
   * `value` signal rather than bound through a form control. There is exactly one chip and no table
   * host for it to register with, so a `viewChild` read is the whole of the plumbing this needs.
   */
  private readonly scopeChip = viewChild("historyScopeFilter", { read: FILTER_CONTROL });

  /** Request ids currently being acted on, so a second click on the same row is a no-op. */
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

  /**
   * Whether either read the table draws from failed. Either one is enough: a failure on one side
   * leaves the merged list short by everything that side holds, which the table cannot say for
   * itself.
   */
  private readonly loadFailed = computed(
    () => this.myLoadError() != null || this.managedLoadError() != null,
  );

  /**
   * Latched true once every source the table draws from has finished loading.
   *
   * Latched, not tracked, so a background reload can't pull the table from under a reader, and
   * sampled on the whole first load so All never renders a partial history as complete. A
   * non-approver's inbox flag stays permanently unraised, and a genuine approver's brief false
   * from `canApprove$` is covered by waiting for the first sync.
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

  /**
   * The skeleton is held back until the load has run for a second, per the component library's
   * display guidance, so a history that arrives quickly never flashes it — arriving at this tab
   * from a sibling, both reads have usually already answered.
   */
  private readonly showSkeleton = toSignal(
    this.historyLoaded$.pipe(
      map((loaded) => !loaded),
      distinctUntilChanged(),
      skeletonLoadingDelay(),
    ),
    { initialValue: false },
  );

  /**
   * Whether the skeleton table is on screen, driving the `role="status"` announcement too, so a
   * load finishing inside the delay never announces a screen the user was not shown.
   *
   * The live region needs the `historyLoaded()` term even though the skeleton markup does not:
   * without it the region keeps announcing "loading" over an already-rendered table.
   */
  protected readonly skeletonVisible = computed(() => this.showSkeleton() && !this.historyLoaded());

  /** Raised once the skeleton has been on screen long enough to announce its removal; lowered after. */
  private readonly skeletonShown = signal(false);

  /**
   * Whether the live region announces content arrival. Gated on the skeleton having shown and
   * both reads finishing — a failed read resolves the latch like success too, so without the
   * guard the region would claim "loaded" while the shell toasts the error.
   *
   * Transient, so a later re-read isn't handed a stale "loaded".
   */
  protected readonly announceLoaded = computed(
    () => this.skeletonShown() && !this.skeletonVisible() && !this.loadFailed(),
  );

  private readonly hasManagedHistory = computed(() => this.managedRows().length > 0);

  /**
   * Offered to anyone who can approve, rows or not — gating on rows would hide the filters until
   * there is something to filter. `hasManagedHistory()` also covers a viewer with managed rows
   * whom the privilege predicate does not recognize as an approver.
   */
  protected readonly canSwitchScope = computed(() => this.canApprove() || this.hasManagedHistory());

  /**
   * Derived straight from the chip's own value rather than mirrored into a signal, so there is
   * exactly one source of truth for the scope — the same shape the sibling access-audit page uses
   * for its chips.
   *
   * Falls back to All, synchronously, if the chip disappears while filtered; the choice is
   * forgotten, so a returning chip can't silently re-narrow the table. The `@if` in the template
   * destroys the chip whenever {@link canSwitchScope} goes false, so a chip that returns starts
   * unset — this needs no extra bookkeeping to forget a stale pick.
   */
  protected readonly scope = computed<HistoryScope>(() => {
    const value = this.scopeChip()?.value();
    return this.canSwitchScope() && (value === HistoryScope.Mine || value === HistoryScope.Managed)
      ? value
      : HistoryScope.All;
  });

  /**
   * Both sources in one list, de-duplicated by request id and re-sorted on the shared key. A row
   * both reads return keeps the caller's own copy: `buildMyAccessRequestRows` folds an approved
   * extension onto the grant it extended and fills in the "Extended" badge, which the inbox's
   * straight row mapping leaves null.
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
   * Shown exactly when something in the current list is actionable, via the same predicates the
   * cells use — managed-ness alone is weaker, since it also holds for decided-and-done requests.
   * Keyed off the listed rows, not the viewer's privilege or the scope.
   */
  protected readonly showActionsColumn = computed(() =>
    this.historyRows().some((row) => this.canRevoke(row) || this.canCancelApproval(row)),
  );

  /**
   * Each scope answers for the slice it lists. All spans both sources, so borrowing either side's
   * wording tells a reader with no history at all that they have raised nothing — which is only
   * half of what the empty table means.
   */
  protected readonly emptyMessageKey = computed(() => {
    switch (this.scope()) {
      case HistoryScope.Managed:
        return "pamInboxHistoryEmpty";
      case HistoryScope.Mine:
        return "pamMyRequestsHistoryEmpty";
      default:
        return "pamHistoryEmpty";
    }
  });

  protected readonly historyDataSource = new TableDataSource<MyAccessRequestRow>();

  /**
   * The Resolved column's sort, which is what actually orders the rendered table. Sorting on
   * `resolvedAt` alone would send a row that was never decided to the end of the descending sort
   * rather than to its submitted-at place. Ascending: `bitSortable` applies the direction itself.
   */
  protected readonly byResolvedOrSubmitted = (a: MyAccessRequestRow, b: MyAccessRequestRow) =>
    resolvedOrSubmittedMs(a) - resolvedOrSubmittedMs(b);

  /** Five fills the space the table occupies without implying a row count the history may not have. */
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

  /**
   * A lease the caller granted and can still end: managed by them, produced a lease, and the
   * server still holds it open ({@link isLiveManagedLease}).
   *
   * Membership differs from Active access's: that section also drops leases past their effective
   * end, a test these rows can't make since `toRequestRow` leaves them no `extendedUntil`.
   */
  protected canRevoke(row: MyAccessRequestRow): boolean {
    return this.managedIds().has(String(row.id)) && isLiveManagedLease(row);
  }

  /** An approval the requester has not started yet, so it can still be withdrawn. */
  protected canCancelApproval(row: MyAccessRequestRow): boolean {
    return (
      this.managedIds().has(String(row.id)) &&
      row.status === "approved" &&
      row.producedLeaseId == null
    );
  }

  /** End a lease the caller granted, after confirming — this cuts off access already in use. */
  protected async revoke(row: MyAccessRequestRow): Promise<void> {
    if (!this.canRevoke(row) || row.producedLeaseId == null || this.isActing(row)) {
      return;
    }
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "pamInboxRevoke" },
      content: { key: "pamInboxRevokeConfirm" },
      acceptButtonText: { key: "pamInboxRevoke" },
      type: "warning",
    });
    if (!confirmed) {
      return;
    }
    await this.act(row, "pamInboxRevokedToast", "pamInboxRevokeFailed", () =>
      this.inbox.revokeLease(row.id, row.producedLeaseId as unknown as AccessLeaseId),
    );
  }

  /**
   * Withdraws an approval the requester has not started. Confirmed first, since it takes a
   * decision away from a third party and cannot be undone from this screen.
   */
  protected async cancelApproval(row: MyAccessRequestRow): Promise<void> {
    if (!this.canCancelApproval(row) || this.isActing(row)) {
      return;
    }
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "pamInboxWithdrawApproval" },
      content: {
        key: "pamInboxWithdrawApprovalConfirm",
        // The same expression the Item column renders, so the dialog and its row can never name the
        // item differently.
        placeholders: [row.cipherName ?? row.cipherId],
      },
      acceptButtonText: { key: "pamInboxWithdrawApproval" },
      type: "warning",
    });
    if (!confirmed) {
      return;
    }
    await this.act(row, "pamInboxApprovalWithdrawnToast", "pamInboxWithdrawApprovalFailed", () =>
      this.inbox.cancelApproval(row.id as AccessRequestId),
    );
  }

  /** Run a row mutation with the shared busy-flag, success toast, and failure toast. */
  private async act(
    row: MyAccessRequestRow,
    successKey: string,
    failureKey: string,
    action: () => Promise<void>,
  ): Promise<void> {
    const key = String(row.id);
    this.acting.update((ids) => new Set([...ids, key]));
    try {
      await action();
      this.toastService.showToast({ variant: "success", message: this.i18nService.t(successKey) });
    } catch (e) {
      this.logService.error(e);
      this.toastService.showToast({ variant: "error", message: this.i18nService.t(failureKey) });
    } finally {
      this.acting.update((ids) => {
        const next = new Set(ids);
        next.delete(key);
        return next;
      });
    }
  }
}
