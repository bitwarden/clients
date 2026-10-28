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
  AccessRefreshService,
  AccessRequestSdkService,
  AccessRequestView,
  ApprovalSdkService,
  isActionableRequest,
} from "..";
import { ApprovalPrivilegeService } from "../approvals/approval-privilege.service";
import { isActionableInboxRequest } from "../approvals/inbox-request-filter";

/**
 * Unions the caller's own actionable requests with their approver inbox by id, so a request on both
 * counts once. Also re-reads on local mutations, since a push may be late or never arrive.
 */
export class DefaultPamNavBadgeService implements PamNavBadgeService {
  readonly count$: Observable<number>;

  constructor(
    private accessRequestSdkService: AccessRequestSdkService,
    private approvalSdkService: ApprovalSdkService,
    private approvalPrivilegeService: ApprovalPrivilegeService,
    private accessEventService: AccessEventService,
    private accessRefreshService: AccessRefreshService,
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

  /** Needs no clock, since every mutation that changes this count sends the requester push. */
  private ownRequestIds$(): Observable<string[]> {
    return merge(of(undefined), this.accessRefreshService.accessChanged$()).pipe(
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
   * Re-read on the approver push, which every collection manager gets for each change to the
   * pending set, and on local mutations. The latter carries the requester push too, costing an
   * extra read.
   */
  private inboxRequestIds$(): Observable<string[]> {
    return this.approvalPrivilegeService.canApprove$.pipe(
      switchMap((canApprove) =>
        canApprove
          ? merge(
              of(undefined),
              this.accessEventService.approverInboxChanged$(),
              this.accessRefreshService.accessChanged$(),
            ).pipe(
              switchMap(() =>
                this.actionableIds$(this.approvalSdkService.listInbox(), isActionableInboxRequest),
              ),
            )
          : of<string[]>([]),
      ),
      startWith<string[]>([]),
    );
  }

  /** A failure logs and emits nothing, so `combineLatest` keeps this half's last good value. */
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
