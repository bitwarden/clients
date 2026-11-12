import type { UserId } from "@bitwarden/common/types/guid";
import type { AccessRequestView } from "@bitwarden/sdk-internal";

import { describePamError, isLeaseLive, PamSdkService, sdkIdToString, toSdkId } from "../shared";

/** Whether a lease an approver may still end is running. */
export type ApprovalLeaseLiveness = "live" | "ended";

export type ApprovalVerdict = "approve" | "deny";

/** An access request as the approver sees it. Ids, states and timestamps only. */
export interface ApprovalRow {
  id: string;
  cipherId: string;
  collectionId: string;
  organizationId?: string;
  requesterId: string;
  ruleId?: string;
  status: string;
  leaseNotBefore: string;
  leaseNotAfter: string;
  submittedAt: string;
  resolvedAt?: string;
  extensionOfLeaseId?: string;
  awaitingActivation: boolean;
  /** The human decider's verdict, once the request is decided. */
  verdict?: string;
  producedLeaseId?: string;
  producedLeaseStatus?: string;
  producedLeaseNotAfter?: string;
}

/** The partial view `decide` returns: only what the server guarantees. */
export interface ApprovalDecisionResult {
  id: string;
  status: string;
  resolvedAt?: string;
  verdict: string;
}

export interface ManagedLeaseRow {
  leaseId: string;
  requestId: string;
  cipherId: string;
  collectionId: string;
  organizationId?: string;
  requesterId: string;
  leaseStatus: string;
  notAfter?: string;
  liveness: ApprovalLeaseLiveness;
}

/** The refusals of `decide` and `cancel` that mean someone else got there first. */
export type ApprovalSettledOutcome = "already-resolved" | "window-ended";

const SETTLED_CODES: ReadonlySet<string> = new Set<ApprovalSettledOutcome>([
  "already-resolved",
  "window-ended",
]);

/**
 * The non-fatal outcome behind a failure: the request was already resolved (decided by another
 * approver, withdrawn or retracted) or its window has ended. `undefined` for any other failure.
 */
export function settledOutcome(e: unknown): ApprovalSettledOutcome | undefined {
  const code = describePamError(e).code;
  return code != null && SETTLED_CODES.has(code) ? (code as ApprovalSettledOutcome) : undefined;
}

export function toApprovalRow(view: AccessRequestView): ApprovalRow {
  return {
    id: sdkIdToString(view.id),
    cipherId: sdkIdToString(view.cipherId),
    collectionId: sdkIdToString(view.collectionId),
    organizationId: view.organizationId == null ? undefined : sdkIdToString(view.organizationId),
    requesterId: sdkIdToString(view.requesterId),
    ruleId: view.ruleId == null ? undefined : sdkIdToString(view.ruleId),
    status: view.status,
    leaseNotBefore: view.leaseNotBefore,
    leaseNotAfter: view.leaseNotAfter,
    submittedAt: view.submittedAt,
    resolvedAt: view.resolvedAt,
    extensionOfLeaseId:
      view.extensionOfLeaseId == null ? undefined : sdkIdToString(view.extensionOfLeaseId),
    awaitingActivation: view.awaitingActivation,
    verdict: view.humanDecision?.verdict,
    producedLeaseId: view.producedLeaseId == null ? undefined : sdkIdToString(view.producedLeaseId),
    producedLeaseStatus: view.producedLeaseStatus,
    producedLeaseNotAfter: view.producedLeaseNotAfter,
  };
}

/** Pending rows whose window already closed can no longer be approved, so they are dropped. */
export function dropExpiredInbox(rows: AccessRequestView[], nowMs: number): AccessRequestView[] {
  return rows.filter((row) => isLeaseLive({ notAfter: row.leaseNotAfter }, nowMs));
}

/**
 * The leases the caller's decisions produced, derived from history rows because the SDK has no
 * org-wide lease list. A lease is live while its status is `active` and its window is open.
 */
export function deriveManagedLeases(rows: AccessRequestView[], nowMs: number): ManagedLeaseRow[] {
  const leases: ManagedLeaseRow[] = [];
  for (const row of rows) {
    if (row.producedLeaseId == null) {
      continue;
    }
    const notAfter = row.producedLeaseNotAfter ?? row.leaseNotAfter;
    const live = row.producedLeaseStatus === "active" && isLeaseLive({ notAfter }, nowMs);
    leases.push({
      leaseId: sdkIdToString(row.producedLeaseId),
      requestId: sdkIdToString(row.id),
      cipherId: sdkIdToString(row.cipherId),
      collectionId: sdkIdToString(row.collectionId),
      organizationId: row.organizationId == null ? undefined : sdkIdToString(row.organizationId),
      requesterId: sdkIdToString(row.requesterId),
      leaseStatus: row.producedLeaseStatus ?? "unknown",
      notAfter,
      liveness: live ? "live" : "ended",
    });
  }
  return leases;
}

/**
 * The approver's operations. Audience is anyone with Manage on a governed collection, or an
 * admin; nothing here gates on a role, because the server decides who is an approver and answers
 * a non-approver with an empty inbox. Comments and reasons are passed through and never logged.
 */
export class ApprovalsService {
  constructor(
    private pamSdk: PamSdkService,
    private now: () => number = () => Date.now(),
  ) {}

  async inbox(userId: UserId): Promise<ApprovalRow[]> {
    const rows = await this.pamSdk.run(userId, (pam) => pam.approvals().list_inbox());
    return dropExpiredInbox(rows, this.now()).map(toApprovalRow);
  }

  async history(userId: UserId): Promise<ApprovalRow[]> {
    const rows = await this.pamSdk.run(userId, (pam) => pam.approvals().list_history());
    return rows.map(toApprovalRow);
  }

  async managedLeases(userId: UserId, includeEnded: boolean): Promise<ManagedLeaseRow[]> {
    const rows = await this.pamSdk.run(userId, (pam) => pam.approvals().list_history());
    const leases = deriveManagedLeases(rows, this.now());
    return includeEnded ? leases : leases.filter((l) => l.liveness === "live");
  }

  /** `decide` returns a partial view, so only the id, status, resolved time and verdict are read. */
  async decide(
    userId: UserId,
    requestId: string,
    verdict: ApprovalVerdict,
    comment: string | undefined,
  ): Promise<ApprovalDecisionResult> {
    const id = toSdkId<AccessRequestView["id"]>(requestId, "request id");
    const view = await this.pamSdk.run(userId, (pam) =>
      pam.approvals().decide(id, { verdict, comment }),
    );
    const decided = view.decisions?.[view.decisions.length - 1];
    return {
      id: sdkIdToString(view.id),
      status: view.status,
      resolvedAt: view.resolvedAt,
      verdict: view.humanDecision?.verdict ?? decided?.verdict ?? verdict,
    };
  }

  /** Cancels an approved request that was not started. The server records it as the approver's denial. */
  async withdraw(userId: UserId, requestId: string): Promise<void> {
    const id = toSdkId<AccessRequestView["id"]>(requestId, "request id");
    await this.pamSdk.run(userId, (pam) => pam.access_requests().cancel(id));
  }

  /** Ends a live lease through `leases().end`. The reason goes to the audit trail only. */
  async revokeLease(userId: UserId, leaseId: string, reason: string | undefined): Promise<void> {
    const id = toSdkId<NonNullable<AccessRequestView["producedLeaseId"]>>(leaseId, "lease id");
    await this.pamSdk.run(userId, (pam) => pam.leases().end(id, { reason }));
  }
}
