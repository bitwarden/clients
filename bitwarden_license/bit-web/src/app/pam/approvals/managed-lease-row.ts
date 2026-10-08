import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";

import type {
  AccessLeaseId,
  AccessLeaseStatus,
  AccessRequestId,
  AccessRequestStatus,
  AccessRequestView,
} from "../abstractions/access-lease";
import { ResolvedNames } from "../access-requests/access-name-resolver.service";
import { LeaseExtensionSummary } from "../access-requests/my-access-row";

/**
 * A lease live right now on a collection the caller manages. Kept apart from
 * {@link MyAccessRequestRow}, which carries no requester identity.
 */
export type ManagedLeaseRow = {
  /** The request that produced the lease; each row links to its `/pam/requests/:id` page. */
  requestId: AccessRequestId;
  /** The live lease itself, the id `ApproverInboxService.revokeLease` ends. */
  leaseId: AccessLeaseId;
  cipherId: string;
  collectionId: string;
  /** The gated cipher's display name, falling back to its raw id when absent from the local vault. */
  cipherName: string;
  collectionName: string | null;
  /** The holder's name, falling back to their email, then empty. */
  requester: string;
  requesterEmail: string | null;
  startsAt: string;
  /** The lease's effective end: the latest extension's end, else the request's window end. */
  endsAt: string;
  /** Sort key for the Remaining column. */
  endsAtMs: number;
  extendedBySeconds: number | null;
  extendedUntil: string | null;
  /** Lowercased haystack for the free-text filter. */
  searchText: string;
};

/** The fields {@link isLiveManagedLease} reads, so a raw request and a built row both qualify. */
type LeaseProducing = {
  producedLeaseId: unknown;
  producedLeaseStatus: AccessLeaseStatus | null | undefined;
};

/**
 * Whether this request minted a lease the server reported `active` when read. The lease can lapse
 * after that read, so callers must also test the effective end.
 */
export function isLiveManagedLease<T extends LeaseProducing>(
  request: T,
): request is T & { producedLeaseId: NonNullable<T["producedLeaseId"]> } {
  return request.producedLeaseId != null && request.producedLeaseStatus === "active";
}

/** The fields {@link isUnstartedApproval} reads, so a raw request and a built row both qualify. */
type ApprovalProducing = {
  status: AccessRequestStatus;
  producedLeaseId: unknown;
};

/**
 * Whether the approval can still be withdrawn: approved, and not yet started by the requester.
 * Reads no window, unlike the requester's own cancel ({@link isRedeemableGrant}).
 */
export function isUnstartedApproval(request: ApprovalProducing): boolean {
  return request.status === "approved" && request.producedLeaseId == null;
}

/**
 * An extension applies to the lease in place without moving the request's `leaseNotAfter`, so
 * `extension` supplies the effective end.
 */
export function toManagedLeaseRow(
  request: AccessRequestView & { producedLeaseId: AccessLeaseId },
  names: ResolvedNames,
  extension?: LeaseExtensionSummary,
): ManagedLeaseRow {
  const cipherId = uuidAsString(request.cipherId);
  const collectionId = uuidAsString(request.collectionId);
  const cipherName = names.cipherNameById.get(cipherId) ?? cipherId;
  const collectionName = names.collectionNameById.get(collectionId) ?? null;
  const extended = extension != null && extension.latestEndMs > 0;
  const endsAtMs = extended ? extension.latestEndMs : Date.parse(request.leaseNotAfter);
  const endsAt = extended ? new Date(endsAtMs).toISOString() : request.leaseNotAfter;

  return {
    requestId: request.id,
    leaseId: request.producedLeaseId,
    cipherId,
    collectionId,
    cipherName,
    collectionName,
    requester: request.requesterName || request.requesterEmail || "",
    requesterEmail: request.requesterEmail ?? null,
    startsAt: request.leaseNotBefore,
    endsAt,
    endsAtMs,
    extendedBySeconds: extended ? extension.addedSeconds : null,
    extendedUntil: extended ? endsAt : null,
    searchText: [cipherName, collectionName, request.requesterName, request.requesterEmail]
      .filter((value): value is string => !!value)
      .join(" ")
      .toLowerCase(),
  };
}
