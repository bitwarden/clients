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
 * Two halves, one per tab the Access requests page badges of its own accord:
 *  - the caller's own requests still needing something from them (`list_mine()`), and
 *  - the requests awaiting the caller's decision (`list_inbox()`), read ONLY for a caller who can
 *    actually approve. Reading the inbox for everyone would mean a guaranteed-empty request per
 *    page open, and would badge the nav for a member with nothing to decide — which is why this
 *    gates on {@link ApprovalPrivilegeService} rather than just summing the two reads.
 *
 * The two are unioned by request id, not added: a manager who requests access to a cipher in a
 * collection they manage holds one request that appears on both tabs, and that is one piece of work,
 * not two.
 *
 * `shareReplay({ refCount: true })` because the nav slot and anything else that badges the same
 * number must not each fire their own reads, while `refCount` still releases the upstream
 * subscription — and with it the push-channel attachment — once nothing is rendering a badge.
 *
 * A failed read reports the previous count rather than erroring: a nav badge must never be able to
 * break navigation. With the feature flag off it reports `0` without calling the SDK at all.
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
   * The requests awaiting the caller's decision, or nothing at all for a caller who approves
   * nothing. Re-read on the approver-side push rather than the requester one: the server sends
   * `RefreshApproverInbox` to every manager of the collection on submit, decide, activate, cancel,
   * revoke and extend, so it covers every way the pending set can move — including the caller's own
   * decisions, which they receive on their own device.
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
