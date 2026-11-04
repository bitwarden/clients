import {
  catchError,
  combineLatest,
  concat,
  defer,
  EMPTY,
  distinctUntilChanged,
  filter,
  map,
  merge,
  Observable,
  of,
  shareReplay,
  startWith,
  switchMap,
  take,
} from "rxjs";

import {
  AccessEventService,
  AccessRefreshService,
  AccessRequestSdkService,
  AccessRequestView,
  ApprovalSdkService,
  isActionableRequest,
} from "@bitwarden/bit-common/pam";
import { AccessBadgeTickerService } from "@bitwarden/bit-common/pam/access-state-badge/access-badge-ticker.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { PamNavBadgeService } from "@bitwarden/web-vault/app/pam/pam-nav-badge.service";

import { ApprovalPrivilegeService } from "../approvals/approval-privilege.service";
import { isActionableInboxRequest } from "../approvals/inbox-request-filter";

/**
 * Unions the caller's own actionable requests with their approver inbox by id, so a request on both
 * counts once. Also re-reads on local mutations, since a push may be late or never arrive. Reads
 * nothing for a user in no PAM organization, whose nav item is hidden.
 */
export class DefaultPamNavBadgeService implements PamNavBadgeService {
  readonly count$: Observable<number>;

  constructor(
    private accessRequestSdkService: AccessRequestSdkService,
    private approvalSdkService: ApprovalSdkService,
    private approvalPrivilegeService: ApprovalPrivilegeService,
    private accessEventService: AccessEventService,
    private accessRefreshService: AccessRefreshService,
    private accessBadgeTickerService: AccessBadgeTickerService,
    private accountService: AccountService,
    private organizationService: OrganizationService,
    private configService: ConfigService,
    private logService: LogService,
  ) {
    this.count$ = this.configService.getFeatureFlag$(FeatureFlag.Pam).pipe(
      switchMap((enabled) => (enabled ? this.memberOfPamOrg$() : of(false))),
      switchMap((member) => (member ? this.liveCount$() : of(0))),
      distinctUntilChanged(),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }

  /** The nav slot's own check, so the badge reads only when its item shows. */
  private memberOfPamOrg$(): Observable<boolean> {
    return this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => this.organizationService.organizations$(userId)),
      map((organizations) => organizations.some((organization) => organization.usePam)),
      distinctUntilChanged(),
    );
  }

  private liveCount$(): Observable<number> {
    return combineLatest([this.ownRequestIds$(), this.inboxRequestIds$()]).pipe(
      map(([own, inbox]) => new Set([...own, ...inbox]).size),
    );
  }

  private ownRequestIds$(): Observable<string[]> {
    return merge(of(undefined), this.accessRefreshService.accessChanged$()).pipe(
      switchMap(() =>
        this.actionableIds$(
          () => this.accessRequestSdkService.listMyAccessRequests(),
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
                this.actionableIds$(
                  () => this.approvalSdkService.listInbox(),
                  isActionableInboxRequest,
                ),
              ),
            )
          : of<string[]>([]),
      ),
      startWith<string[]>([]),
    );
  }

  /**
   * Reads again once the earliest counted window ends, since the server sends no push for that.
   * Only an end still ahead schedules it, so a request the server reports pending just past its end
   * can't re-read on every tick. A failure logs and emits nothing, so `combineLatest` keeps this
   * half's last good value.
   */
  private actionableIds$(
    read: () => Promise<AccessRequestView[]>,
    needsAttention: (request: AccessRequestView, now: Date) => boolean,
  ): Observable<string[]> {
    return defer(read).pipe(
      switchMap((requests) => {
        const now = new Date();
        const counted = requests.filter((request) => needsAttention(request, now));
        const ids = counted.map((request) => uuidAsString(request.id));
        const nextEndMs = Math.min(
          ...counted
            .map((request) => Date.parse(request.leaseNotAfter))
            .filter((endMs) => endMs > now.getTime()),
        );
        if (!Number.isFinite(nextEndMs)) {
          return of(ids);
        }
        return concat(
          of(ids),
          this.accessBadgeTickerService.ticks$.pipe(
            filter((nowMs) => nowMs >= nextEndMs),
            take(1),
            switchMap(() => this.actionableIds$(read, needsAttention)),
          ),
        );
      }),
      catchError((error: unknown) => {
        this.logService.error(error);
        return EMPTY;
      }),
    );
  }
}
