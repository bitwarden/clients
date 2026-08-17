import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";

import type { AccessRequestId, AccessRequestView } from "../abstractions/access-lease";
import { ResolvedNames } from "../access-requests/access-name-resolver.service";
import { ElapsedLabel, elapsedLabel } from "../date/elapsed";
import {
  durationLabel,
  exactWindow,
  LabelValue,
  reasonText,
  relativeStart,
} from "../helpers/approval-window";

/**
 * A row in the approver's inbox.
 *
 * Every display value is precomputed here rather than in the template: `bit-table`'s `bitSortable`
 * sorts on literal row fields, and the free-text filter needs one lowercase haystack per row rather
 * than a predicate that re-reads five nested properties per keystroke.
 *
 * The window and reason labels come from the shared `helpers/approval-window` functions the
 * requester-facing pages already use, so an approver and a requester never read the same window
 * differently.
 */
export type ApprovalRow = {
  id: AccessRequestId;
  /** Kept whole so the decide dialog can render the request without a second lookup. */
  request: AccessRequestView;
  cipherId: string;
  collectionId: string;
  /** The gated cipher's display name, falling back to its raw id when it isn't in the local vault. */
  cipherName: string;
  collectionName: string | null;
  /** The requester's name, falling back to their email, then empty when the server resolved neither. */
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
   * False when the viewer raised this request themselves. No self-approval: the button is disabled
   * rather than hidden so the reason can be explained in a tooltip instead of the row looking broken.
   */
  canDecide: boolean;
  /** Lowercased haystack for the free-text filter. */
  searchText: string;
};

/**
 * Build one inbox row. `canDecide` is passed in rather than derived here so the row model stays free
 * of any notion of "the current user"; the service that knows the active user decides it.
 */
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
  const requester = request.requesterName || request.requesterEmail || "";

  return {
    id: request.id,
    request,
    cipherId,
    collectionId,
    cipherName,
    collectionName,
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

/**
 * Oldest-waiting first, so the request most at risk of timing out is at the top; ties broken by
 * collection name to keep the order stable rather than dependent on the server's.
 */
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
