import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";

import type { AccessRequestId, AccessRequestView } from "../abstractions/access-lease";
import {
  ResolvedNames,
  organizationNameFor,
} from "../access-requests/access-name-resolver.service";
import { ElapsedLabel, elapsedLabel } from "../date/elapsed";
import {
  durationLabel,
  exactWindow,
  LabelValue,
  reasonText,
  relativeStart,
} from "../helpers/approval-window";

/**
 * A row in the approver's inbox. Display values are precomputed because `bitSortable` sorts on
 * literal row fields and the free-text filter needs one lowercase haystack per row.
 */
export type ApprovalRow = {
  id: AccessRequestId;
  request: AccessRequestView;
  cipherId: string;
  collectionId: string;
  /** The gated cipher's display name, falling back to its raw id when absent from the local vault. */
  cipherName: string;
  collectionName: string | null;
  /** The owning organization's display name, null when the request or lookup lacks it. */
  organizationName: string | null;
  /** The requester's name, falling back to email, then blank when the server resolved neither. */
  requester: string;
  requesterEmail: string | null;
  /** Sort key for the Submitted column. */
  submittedAtMs: number;
  /** How long the request has been waiting. */
  elapsed: ElapsedLabel;
  reason: string | null;
  duration: LabelValue;
  relativeStart: LabelValue;
  exactWindow: string;
  /**
   * False when the viewer raised this request. The button is disabled, not hidden, so a tooltip
   * can explain why.
   */
  canDecide: boolean;
  /** Lowercased haystack for the free-text filter. */
  searchText: string;
};

/** `canDecide` comes from the caller, so the row model stays free of the current user. */
export function toApprovalRow(
  request: AccessRequestView,
  names: ResolvedNames,
  now: Date,
  canDecide: boolean,
): ApprovalRow {
  const cipherId = uuidAsString(request.cipherId);
  const collectionId = uuidAsString(request.collectionId);
  const cipherName = names.cipherNameById.get(cipherId) ?? cipherId;
  const collectionName = names.collectionNameById.get(collectionId) ?? null;
  const organizationName = organizationNameFor(request, names);
  const requester = request.requesterName || request.requesterEmail || "";

  return {
    id: request.id,
    request,
    cipherId,
    collectionId,
    cipherName,
    collectionName,
    organizationName,
    requester,
    requesterEmail: request.requesterEmail ?? null,
    submittedAtMs: Date.parse(request.submittedAt),
    elapsed: elapsedLabel(request.submittedAt, now),
    reason: reasonText(request),
    duration: durationLabel(request),
    relativeStart: relativeStart(request, now),
    exactWindow: exactWindow(request),
    canDecide,
    searchText: [cipherName, collectionName, request.requesterName, request.requesterEmail]
      .filter((value): value is string => !!value)
      .join(" ")
      .toLowerCase(),
  };
}

/** Longest-waiting first, ties broken by collection name rather than the server's order. */
export function sortApprovalRows(rows: readonly ApprovalRow[]): ApprovalRow[] {
  return rows.slice().sort((a, b) => {
    const bySubmitted = a.submittedAtMs - b.submittedAtMs;
    if (bySubmitted !== 0) {
      return bySubmitted;
    }
    return (a.collectionName ?? "").localeCompare(b.collectionName ?? "", undefined, {
      sensitivity: "base",
    });
  });
}
