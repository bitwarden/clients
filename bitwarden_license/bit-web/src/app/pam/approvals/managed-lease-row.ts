import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";

import type {
  AccessLeaseId,
  AccessRequestId,
  AccessRequestView,
} from "../abstractions/access-lease";
import { ResolvedNames } from "../access-requests/access-name-resolver.service";
import { LeaseExtensionSummary } from "../access-requests/my-access-row";

/**
 * A lease that is live right now on a collection the caller manages.
 *
 * Separate from {@link MyAccessRequestRow} rather than an extension of it: that model carries no
 * requester identity and is shared with the requester-facing tabs, where "who holds this" is always
 * the viewer.
 */
export type ManagedLeaseRow = {
  /** The request that produced the lease — every row links to /pam/requests/:id. */
  requestId: AccessRequestId;
  /** The live lease itself, the id `ApproverInboxService.revokeLease` ends. */
  leaseId: AccessLeaseId;
  cipherId: string;
  collectionId: string;
  /** null when the cipher isn't in the caller's local vault; the template falls back to the id. */
  cipherName: string | null;
  collectionName: string | null;
  /** The holder's name, falling back to their email, then empty. */
  requester: string;
  requesterEmail: string | null;
  startsAt: string;
  /** The lease's EFFECTIVE end: the latest applied extension's end, else the request's window end. */
  endsAt: string;
  /** Sort key for the Remaining column. */
  endsAtMs: number;
  extendedBySeconds: number | null;
  extendedUntil: string | null;
  /** Lowercased haystack for the free-text filter. */
  searchText: string;
};

/**
 * Whether this request's grant is running right now.
 *
 * Reads the request, never the display badge: `historyDisplayStatus` only reaches its activated
 * branch for `status === "approved"`, and an activated grant can arrive with a status the client
 * reads otherwise, which would empty this section in the product while every test still passed.
 */
export function isLiveManagedLease(
  request: AccessRequestView,
): request is AccessRequestView & { producedLeaseId: AccessLeaseId } {
  return request.producedLeaseId != null && request.producedLeaseStatus === "active";
}

/**
 * Build one live-lease row.
 *
 * `extension` is the summary for the produced lease, if any. An extension is applied to the lease in
 * place and never moves the originating request's `leaseNotAfter`, so an extended lease whose row
 * showed the request's end would tell an operator that access ends sooner than it does.
 */
export function toManagedLeaseRow(
  request: AccessRequestView & { producedLeaseId: AccessLeaseId },
  names: ResolvedNames,
  extension?: LeaseExtensionSummary,
): ManagedLeaseRow {
  const cipherId = uuidAsString(request.cipherId);
  const collectionId = uuidAsString(request.collectionId);
  const cipherName = names.cipherNameById.get(cipherId) ?? null;
  const collectionName = names.collectionNameById.get(collectionId) ?? null;
  const extended = extension != null && extension.latestEndMs > 0;
  const endsAt = extended ? new Date(extension.latestEndMs).toISOString() : request.leaseNotAfter;

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
    endsAtMs: Date.parse(endsAt),
    extendedBySeconds: extended ? extension.addedSeconds : null,
    extendedUntil: extended ? endsAt : null,
    searchText: [cipherName, collectionName, request.requesterName, request.requesterEmail]
      .filter((value): value is string => !!value)
      .join(" ")
      .toLowerCase(),
  };
}
