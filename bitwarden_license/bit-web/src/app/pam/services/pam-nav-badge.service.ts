import {
  catchError,
  combineLatest,
  EMPTY,
  distinctUntilChanged,
  from,
  map,
  merge,
  Observable,
  of,
  shareReplay,
  startWith,
  switchMap,
} from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { PamNavBadgeService } from "@bitwarden/web-vault/app/pam/pam-nav-badge.service";

import {
  AccessEventService,
  AccessRequestSdkService,
  AccessRequestView,
  ApprovalSdkService,
  isActionableRequest,
} from "..";
import { ApprovalPrivilegeService } from "../approvals/approval-privilege.service";
import { isActionableInboxRequest } from "../approvals/inbox-request-filter";

/**
 * PAM's {@link PamNavBadgeService}: how much unattended access work the caller has, refreshed
 * whenever the server says something changed.
 *
 * Two halves: the caller's own requests still needing something from them (`list_mine()`), and
 * the requests awaiting their decision (`list_inbox()`), read only for a caller who can
 * actually approve — gated on {@link ApprovalPrivilegeService} rather than always summing both.
 *
 * The two are unioned by request id, not added, since a manager's own request in a collection
 * they manage appears on both tabs as one piece of work.
 *
 * `shareReplay({ refCount: true })` so every badge consumer shares one read, while `refCount`
 * still releases the push-channel subscription once nothing renders a badge.
 *
 * A failed read reports the previous count rather than erroring, and reports `0` without
 * calling the SDK when the feature flag is off.
 */
export class DefaultPamNavBadgeService implements PamNavBadgeService {
  readonly count$: Observable<number>;

  constructor(
    private accessRequestSdkService: AccessRequestSdkService,
    private approvalSdkService: ApprovalSdkService,
    private approvalPrivilegeService: ApprovalPrivilegeService,
    private accessEventService: AccessEventService,
    private configService: ConfigService,
    private logService: LogService,
  ) {
    this.count$ = this.configService.getFeatureFlag$(FeatureFlag.Pam).pipe(
      switchMap((enabled) => (enabled ? this.liveCount$() : of(0))),
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  private liveCount$(): Observable<number> {
    return combineLatest([this.ownRequestIds$(), this.inboxRequestIds$()]).pipe(
      map(([own, inbox]) => new Set([...own, ...inbox]).size),
    );
  }

  /**
   * The caller's own actionable requests, re-read on the requester-side push. Every mutation that
   * changes what this counts sends it, so this needs no clock of its own.
   */
  private ownRequestIds$(): Observable<string[]> {
    return merge(of(undefined), this.accessEventService.accessChanged$()).pipe(
      switchMap(() =>
        this.actionableIds$(
          this.accessRequestSdkService.listMyAccessRequests(),
          isActionableRequest,
        ),
      ),
      startWith<string[]>([]),
    );
  }

  /**
   * The requests awaiting the caller's decision, or nothing for a caller who approves nothing.
   * Re-read on the approver-side push, not the requester one: the server sends
   * `RefreshApproverInbox` to every collection manager on submit, decide, activate, cancel,
   * revoke and extend, covering every way the pending set can move.
   */
  private inboxRequestIds$(): Observable<string[]> {
    return this.approvalPrivilegeService.canApprove$.pipe(
      switchMap((canApprove) =>
        canApprove
          ? merge(of(undefined), this.accessEventService.approverInboxChanged$()).pipe(
              switchMap(() =>
                this.actionableIds$(this.approvalSdkService.listInbox(), isActionableInboxRequest),
              ),
            )
          : of<string[]>([]),
      ),
      startWith<string[]>([]),
    );
  }

  /**
   * One read, reduced to the ids still needing attention. A failure logs and emits nothing, which
   * leaves the enclosing `combineLatest` holding the last good value for this half.
   */
  private actionableIds$(
    read: Promise<AccessRequestView[]>,
    needsAttention: (request: AccessRequestView, now: Date) => boolean,
  ): Observable<string[]> {
    return from(read).pipe(
      map((requests) => {
        const now = new Date();
        return requests
          .filter((request) => needsAttention(request, now))
          .map((request) => uuidAsString(request.id));
      }),
      catchError((error: unknown) => {
        this.logService.error(error);
        return EMPTY;
      }),
    );
  }
}
