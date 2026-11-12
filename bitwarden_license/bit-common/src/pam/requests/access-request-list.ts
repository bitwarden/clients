import type { AccessRequestStatus, AccessRequestView } from "@bitwarden/sdk-internal";

import { PamInputError } from "../shared/pam-input-error";
import { sanitizeUntrusted } from "../shared/sanitize-untrusted";

/** The values `--status` accepts. `canceled` has one L, as in the SDK. */
export const ACCESS_REQUEST_STATUS_FILTERS: readonly Exclude<AccessRequestStatus, "unknown">[] =
  Object.freeze(["pending", "approved", "denied", "canceled", "expired"] as const);

/**
 * Validates `--status`. Activation is not a status: an activated request stays `approved` and
 * carries `producedLeaseId` and `producedLeaseStatus` instead.
 * @throws PamInputError when `value` is not a status.
 */
export function parseStatusFilter(
  value: string | undefined,
): Exclude<AccessRequestStatus, "unknown"> | undefined {
  if (value == null) {
    return undefined;
  }
  const candidate = value.trim().toLowerCase();
  const match = ACCESS_REQUEST_STATUS_FILTERS.find((s) => s === candidate);
  if (match != null) {
    return match;
  }
  if (candidate === "cancelled") {
    throw new PamInputError("Use `canceled`, spelled with one L.");
  }
  if (candidate === "active" || candidate === "activated") {
    throw new PamInputError(
      "Activation is not a status. An activated request is `approved` and shows producedLeaseId and producedLeaseStatus.",
    );
  }
  throw new PamInputError(
    `\`${sanitizeUntrusted(value, 32)}\` is not a request status. Use one of ${ACCESS_REQUEST_STATUS_FILTERS.join(", ")}.`,
  );
}

/** A request with the extension requests that belong to it. */
export interface FoldedAccessRequest {
  request: AccessRequestView;
  /** Ids of the extension requests of the lease this request produced, newest first. */
  extensionRequestIds: string[];
  /** Whether one of those extensions is still pending. */
  extensionPending: boolean;
}

const byNewest = (a: AccessRequestView, b: AccessRequestView) =>
  Date.parse(b.submittedAt) - Date.parse(a.submittedAt);

/**
 * Folds each extension request onto the request that produced the lease it extends, so a list
 * shows one row per grant. An extension whose parent is not in `requests` stays a row of its own.
 * Newest first.
 */
export function foldExtensionRequests(
  requests: readonly AccessRequestView[],
): FoldedAccessRequest[] {
  const sorted = [...requests].sort(byNewest);
  const parentByLease = new Map<string, FoldedAccessRequest>();
  const rows: FoldedAccessRequest[] = [];

  for (const request of sorted) {
    if (request.extensionOfLeaseId == null) {
      const row: FoldedAccessRequest = {
        request,
        extensionRequestIds: [],
        extensionPending: false,
      };
      rows.push(row);
      if (request.producedLeaseId != null) {
        parentByLease.set(String(request.producedLeaseId), row);
      }
    }
  }

  for (const request of sorted) {
    if (request.extensionOfLeaseId == null) {
      continue;
    }
    const parent = parentByLease.get(String(request.extensionOfLeaseId));
    if (parent == null) {
      rows.push({
        request,
        extensionRequestIds: [],
        extensionPending: false,
      });
      continue;
    }
    parent.extensionRequestIds.push(String(request.id));
    parent.extensionPending = parent.extensionPending || request.status === "pending";
  }

  return rows.sort((a, b) => byNewest(a.request, b.request));
}

/** Folds, then keeps the rows whose own status is `status`. */
export function listAccessRequestRows(
  requests: readonly AccessRequestView[],
  status: AccessRequestStatus | undefined,
): FoldedAccessRequest[] {
  const rows = foldExtensionRequests(requests);
  return status == null ? rows : rows.filter((row) => row.request.status === status);
}
