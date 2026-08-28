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
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { skeletonLoadingDelay } from "@bitwarden/common/vault/utils/skeleton-loading.operator";
import {
  BadgeComponent,
  ButtonModule,
  DialogService,
  NoItemsModule,
  SkeletonComponent,
  SkeletonTextComponent,
  TableDataSource,
  TableModule,
  ToastService,
  ToggleGroupModule,
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
 * "History" tab — decided requests, drawn from two sources:
 *
 *  - Mine: the caller's own terminal requests (everything but pending/approved, which live on the My
 *    requests tab).
 *  - Managed: the decided requests for the collections the caller manages — the only rows they can
 *    undo a decision on.
 *
 * The tab opens on All, which lists both sources merged, and the toggle narrows that list to one
 * source. Landing on everything means the reader is never answered with an empty table while their
 * history sits behind a control they had no reason to press, and — unlike a default read off which
 * side happens to have rows — the selection cannot move under them when a background load arrives.
 *
 * Merging is safe because both sources are already the same row model, sorted on the same key. What
 * differs is what a row permits: `managedIds` is the per-row authority, so a row carries the same
 * actions under All as under the filter it came from, and a row the caller merely raised carries
 * none. A request the caller raised against a collection they also manage is returned by both reads,
 * so All de-duplicates by request id, keeping the caller's own copy — only that side fills in the
 * extension the grant was given.
 *
 * Own rows are read-only, so a caller with no approval privilege has no managed rows, gets no
 * Actions column, and is shown no toggle — every option would be a filter over the same one list.
 * `Managed` adds revoke (end a lease the caller granted) and withdraw (take back an approval the
 * requester has not started), both of which the SDK serves.
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
    IconComponent,
    NoItemsModule,
    SkeletonComponent,
    SkeletonTextComponent,
    TableModule,
    ToggleGroupModule,
    TypographyModule,
    I18nPipe,
    DurationShortPipe,
    RelativeTimePipe,
  ],
})
export class HistoryTabComponent {
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

  /** The filter the viewer picked from the toggle. */
  private readonly selectedScope = signal<HistoryScope>(HistoryScope.All);

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
   * Latched true the first time every source the table draws from has finished loading — which is
   * all the skeleton is waiting for: nothing about the opening view is read off the rows.
   *
   * Latched rather than tracked so a background reload cannot pull the table out from under whoever
   * is reading it. Sampling the whole first load, rather than clearing as soon as any one source
   * answers, also keeps All from rendering half its rows as though they were all of them.
   *
   * The shell only loads the inbox for a caller who can approve, so for everyone else that flag
   * stays raised for the life of the page and cannot be waited on. `canApprove$` is derived from
   * synced organization and collection state, so before the first sync lands it answers `false` for
   * a genuine approver too; until a sync date exists a `false` there is not a settled "not an
   * approver", and the inbox still has to be waited on. Nothing else on this path awaits the sync —
   * the history route has no guard; `canViewApprovalsGuard` waits the same way for the same reason
   * on the sibling tab.
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
   * Whether the skeleton table is on screen. Drives the `role="status"` announcement as well, so
   * that a load finishing inside the delay never announces a screen the user was not shown.
   *
   * The `historyLoaded()` term buys nothing for the skeleton markup — the template gates that on the
   * same flag, and so ends the skeleton as soon as the rows are in hand rather than holding it for
   * whatever the operator has left of its minimum display time. It is the live region, which sits
   * outside that block, that needs the term: without it the region goes on announcing "loading" over
   * an already rendered table.
   */
  protected readonly skeletonVisible = computed(() => this.showSkeleton() && !this.historyLoaded());

  /**
   * Raised once the skeleton has been on screen, so its removal can be announced in turn, and
   * lowered again once that announcement has had its moment in the live region.
   */
  private readonly skeletonShown = signal(false);

  /**
   * Whether the live region announces that the content has arrived. Emptying the region announces
   * nothing on its own, so the "loading" announcement needs a counterpart once the rows land. Gated
   * on the skeleton having been shown, so a load that finishes inside the delay announces neither
   * half, and on both reads having succeeded — a failed read resolves the latch exactly like a
   * successful one and leaves the same empty table behind, so without the guard the region claims a
   * history has loaded while the shell is toasting the error for the very same load. A sighted user
   * reads the toast against the empty table; the announcement is the reading that cannot be
   * corrected.
   *
   * The announcement is transient: assistive tech that re-reads a region's contents on demand would
   * otherwise be handed a load that finished minutes ago as though it were current.
   */
  protected readonly announceLoaded = computed(
    () => this.skeletonShown() && !this.skeletonVisible() && !this.loadFailed(),
  );

  private readonly hasManagedHistory = computed(() => this.managedRows().length > 0);

  /**
   * The toggle is offered to anyone who can approve, rows or not — gating it on rows hides the
   * filters until there is something to filter, which is exactly when the reader no longer needs
   * telling they exist. The `hasManagedHistory()` term keeps it for a viewer who has managed rows
   * but whom the privilege predicate does not recognise as an approver.
   */
  protected readonly canSwitchScope = computed(() => this.canApprove() || this.hasManagedHistory());

  /**
   * Falls back to All if the toggle goes away while a filter is applied — synchronously here, and
   * forgotten by the effect that clears the pick, so a toggle that returns cannot silently narrow
   * the table back to a filter the reader last chose under different circumstances.
   */
  protected readonly scope = computed<HistoryScope>(() =>
    this.canSwitchScope() ? this.selectedScope() : HistoryScope.All,
  );

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
   * Shown exactly when something in the current list can be acted on, asked with the same two
   * predicates the cells answer to — so the column cannot outlive the buttons it exists to hold.
   * Managed-ness alone is the weaker question: it holds for every request the caller manages,
   * decided-and-done included, which is most of what a history accumulates.
   *
   * Keyed off the listed rows rather than the viewer's privilege because an approver who has
   * decided nothing yet, and the caller's own rows under "Raised by me", would otherwise get a
   * column of nothing but dashes — and off the rows rather than the scope because a request the
   * caller raised against a collection they manage is actionable under every filter it appears in.
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
    effect(() => {
      if (!this.canSwitchScope()) {
        this.selectedScope.set(HistoryScope.All);
      }
    });
  }

  protected selectScope(scope: HistoryScope): void {
    this.selectedScope.set(scope);
  }

  /** The decrypted cipher for a row, or undefined when it isn't in the caller's vault. */
  protected cipherFor(cipherId: string): CipherView | undefined {
    return this.myCiphers().get(cipherId) ?? this.managedCiphers().get(cipherId);
  }

  protected isActing(row: MyAccessRequestRow): boolean {
    return this.acting().has(String(row.id));
  }

  /**
   * A lease the caller granted and can still end: the row is one they manage, it produced a lease,
   * and the server still holds that lease open. Openness comes from {@link isLiveManagedLease} — the
   * same lease-status signal the Approvals tab's Active access section lists by, read off the
   * request rather than off the derived status badge.
   *
   * Membership is not identical to that section's: Active access also drops rows whose effective end
   * has passed, a test these rows cannot make because `toRequestRow` leaves them no `extendedUntil`.
   * A lease still marked `active` past its window is therefore revocable here and absent there.
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
   * Withdraw an approval the requester has not started. Confirmed first because it takes a decision
   * away from a third party, cannot be undone from this screen, and the requester is not told.
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
