import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { RouterModule } from "@angular/router";
import { combineLatest, filter, map, take } from "rxjs";

import { IconComponent } from "@bitwarden/angular/vault/components/icon.component";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
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

import { MyAccessRequestRow } from "./my-access-row";
import { MyAccessService } from "./my-access.service";

/** Which side of the history the table is showing. */
const HistoryScope = Object.freeze({ Mine: "mine", Managed: "managed" } as const);
type HistoryScope = (typeof HistoryScope)[keyof typeof HistoryScope];

/**
 * "History" tab — decided requests, from two perspectives the viewer can switch between:
 *
 *  - Mine: the caller's own terminal requests (everything but pending/approved, which live on the My
 *    requests tab).
 *  - Managed: the decided requests for the collections the caller manages — offered to anyone who
 *    can approve, and the only place they can undo a decision.
 *
 * An untouched toggle lands on Managed whenever that side has rows, since this tab is aimed at the
 * approver and answering them with an empty table hides the history they came for behind a control
 * they have no reason to press. Nothing is rendered until both sides have answered, and the default
 * is fixed at that one moment rather than tracked: read off rows as they arrive, it would paint the
 * wrong half first, and a later background reload would swap the table — and the toggle's own
 * selection — out from under whoever is reading it.
 *
 * A toggle rather than one merged table. Merging them would put "a request I raised" and "a request I
 * decided" in the same list with the same columns but different available actions, so a row's
 * capabilities would depend on something invisible. Splitting keeps "what can I do to this row?"
 * answerable from what is on screen.
 *
 * Own rows are read-only, so `Mine` has no action column and no clock. `Managed` adds revoke (end a
 * lease the caller granted) and withdraw (take back an approval the requester has not started), both
 * of which the SDK serves.
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

  protected readonly HistoryScope = HistoryScope;

  private readonly canApprove = toSignal(this.approvalPrivileges.canApprove$, {
    initialValue: false,
  });

  /** The scope the viewer picked from the toggle, or null while the default below still applies. */
  private readonly chosenScope = signal<HistoryScope | null>(null);

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

  /**
   * The half to open on, decided once both sides have answered and latched there — null until then,
   * which is what the skeleton renders on.
   *
   * Each service's `loading$` starts true and clears when its `load()` resolves, but the shell only
   * loads the inbox for a caller who can approve, so for everyone else that flag stays raised for
   * the life of the page and cannot be waited on.
   *
   * Hence the sync date. `canApprove$` is derived from synced organization and collection state, so
   * before the first sync lands it answers `false` for a genuine approver too, and taking that for a
   * settled "not an approver" is what opened this tab on the wrong half. Nothing else on this path
   * awaits the sync — the history route has no guard; `canViewApprovalsGuard` waits the same way for
   * the same reason on the sibling tab.
   */
  private readonly openingScope = toSignal(
    combineLatest([
      this.syncService.activeUserLastSync$(),
      this.approvalPrivileges.canApprove$,
      this.inbox.loading$,
      this.myAccess.loading$,
      this.inbox.historyRows$,
    ]).pipe(
      filter(
        ([lastSync, canApprove, inboxLoading, myLoading]) =>
          !myLoading && (canApprove ? !inboxLoading : lastSync != null),
      ),
      take(1),
      map(([, , , , managed]) => (managed.length > 0 ? HistoryScope.Managed : HistoryScope.Mine)),
    ),
    { initialValue: null as HistoryScope | null },
  );

  protected readonly historyReady = computed(() => this.openingScope() != null);

  private readonly hasManagedHistory = computed(() => this.managedRows().length > 0);

  protected readonly scope = computed<HistoryScope>(
    () => this.chosenScope() ?? this.openingScope() ?? HistoryScope.Mine,
  );

  /**
   * The toggle is offered to anyone who can approve, rows or not — gating it on rows hides the
   * second scope until it has content, which is exactly when the reader no longer needs telling it
   * exists. The `hasManagedHistory()` term keeps it for a viewer who has managed rows but whom the
   * privilege predicate does not recognise as an approver.
   */
  protected readonly canSwitchScope = computed(() => this.canApprove() || this.hasManagedHistory());

  protected readonly showingManaged = computed(
    () => this.scope() === HistoryScope.Managed && this.canSwitchScope(),
  );

  protected readonly historyRows = computed(() =>
    this.showingManaged() ? this.managedRows() : this.myRows(),
  );

  protected readonly historyDataSource = new TableDataSource<MyAccessRequestRow>();

  /** Five fills the space the table occupies without implying a row count the history may not have. */
  protected readonly skeletonRows = [0, 1, 2, 3, 4];

  constructor() {
    effect(() => {
      this.historyDataSource.data = this.historyRows();
    });
  }

  /** Pin the scope to the viewer's choice, so a later load cannot move them off it. */
  protected selectScope(scope: HistoryScope): void {
    this.chosenScope.set(scope);
  }

  /** The decrypted cipher for a row, or undefined when it isn't in the caller's vault. */
  protected cipherFor(cipherId: string): CipherView | undefined {
    const source = this.showingManaged() ? this.managedCiphers() : this.myCiphers();
    return source.get(cipherId);
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
    return (
      this.showingManaged() && this.managedIds().has(String(row.id)) && isLiveManagedLease(row)
    );
  }

  /** An approval the requester has not started yet, so it can still be withdrawn. */
  protected canCancelApproval(row: MyAccessRequestRow): boolean {
    return (
      this.showingManaged() &&
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
