import type { BadgeVariant } from "@bitwarden/components";

import type { AccessRequestDecisionView, AccessRequestView } from "../abstractions/access-lease";

import { humanApprover } from "./find-human-decision";

/**
 * The closed outcomes the History tab's detail dialog describes. `expired` is a request whose
 * window passed with no lease minted; `sessionEnded` is a minted lease that ran out or that its
 * holder ended, both a neutral end of access.
 */
export type HistoryOutcome = "denied" | "canceled" | "expired" | "revoked" | "sessionEnded";

export type HistoryOutcomeBadge = {
  readonly labelKey: string;
  readonly variant: BadgeVariant;
  readonly icon: "bwi-lock";
};

/**
 * Denied, Expired and Revoked all left the requester without the access they asked for, so they
 * share the danger recipe; Canceled and Session ended are the requester's own or natural ends.
 */
export const HISTORY_OUTCOME_BADGES: Readonly<Record<HistoryOutcome, HistoryOutcomeBadge>> = {
  denied: { labelKey: "pamStatusDenied", variant: "danger", icon: "bwi-lock" },
  canceled: { labelKey: "pamStatusCanceled", variant: "subtle", icon: "bwi-lock" },
  expired: { labelKey: "pamStatusExpired", variant: "danger", icon: "bwi-lock" },
  revoked: { labelKey: "pamStatusRevoked", variant: "danger", icon: "bwi-lock" },
  sessionEnded: { labelKey: "pamStatusSessionEnded", variant: "subtle", icon: "bwi-lock" },
};

/**
 * The request's closed outcome, or null while it can still change (pending, a redeemable grant, a
 * live lease) or when the SDK reports `unknown`. Reads `producedLeaseStatus` rather than the
 * decision log, as {@link historyDisplayStatus} does.
 */
export function historyOutcome(
  request: Pick<
    AccessRequestView,
    "status" | "producedLeaseId" | "producedLeaseStatus" | "leaseNotAfter"
  >,
  nowMs: number,
): HistoryOutcome | null {
  switch (request.status) {
    case "denied":
    case "canceled":
    case "expired":
      return request.status;
    case "approved":
      if (request.producedLeaseId == null) {
        // A grant whose activation window closed unused; the server only restamps it on a later read.
        return Date.parse(request.leaseNotAfter) <= nowMs ? "expired" : null;
      }
      switch (request.producedLeaseStatus) {
        case "revoked":
          return "revoked";
        case "expired":
        case "canceled":
          return "sessionEnded";
        default:
          return null;
      }
    default:
      return null;
  }
}

export type HistoryDecisionSummary = {
  readonly verdictLabelKey: "pamApprovedBy" | "pamDeniedBy";
  /** The human decider's name, falling back to email; null when an i18n label stands in. */
  readonly deciderName: string | null;
  /** Set for an access rule's decision or an approver with neither name nor email. */
  readonly deciderLabelKey: "pamResolverAccessRule" | "pamResolverUnknown" | null;
  /** Shown on its own row only when it isn't already standing in for the name. */
  readonly email: string | null;
  readonly comment: string | null;
};

/**
 * Who decided the request and what they said, or null when nobody did (a request canceled or
 * expired before any decision). A denied request credits its denial; every other outcome its
 * approval. A revoke records its reason as a later `deny`, which is the comment a Revoked request
 * shows, falling back to the approval's own.
 */
export function historyDecisionSummary(
  request: Pick<AccessRequestView, "decisions" | "requesterId">,
  outcome: HistoryOutcome,
): HistoryDecisionSummary | null {
  const verdict = outcome === "denied" ? "deny" : "approve";
  const index = request.decisions.findIndex((d) => d.verdict === verdict);
  if (index < 0) {
    return null;
  }
  const decision = request.decisions[index];
  const verdictLabelKey = verdict === "deny" ? "pamDeniedBy" : "pamApprovedBy";
  const comment =
    outcome === "revoked"
      ? (revokeComment(request, index) ?? commentOf(decision))
      : commentOf(decision);

  const approver = humanApprover(decision);
  if (approver == null) {
    return {
      verdictLabelKey,
      deciderName: null,
      deciderLabelKey: "pamResolverAccessRule",
      email: null,
      comment,
    };
  }
  const deciderName = approver.name?.trim() || approver.email?.trim() || null;
  const email = approver.email?.trim() || null;
  return {
    verdictLabelKey,
    deciderName,
    deciderLabelKey: deciderName == null ? "pamResolverUnknown" : null,
    email: email === deciderName ? null : email,
    comment,
  };
}

/** The reason on the operator's `deny` that ended the lease, skipping a holder's own end. */
function revokeComment(
  request: Pick<AccessRequestView, "decisions" | "requesterId">,
  approvalIndex: number,
): string | null {
  const revoke = request.decisions
    .slice(approvalIndex + 1)
    .find(
      (d) =>
        d.verdict === "deny" && String(humanApprover(d)?.id ?? "") !== String(request.requesterId),
    );
  return revoke == null ? null : commentOf(revoke);
}

function commentOf(decision: AccessRequestDecisionView): string | null {
  return decision.comment?.trim() || null;
}

const rangeFormats = new Map<string, Intl.DateTimeFormat>();
const dateTimeFormats = new Map<string, Intl.DateTimeFormat>();

/**
 * The requested window as a localized range, e.g. "Oct 21, 4:12 – 8:12 PM". The year is dropped
 * when the whole window falls in the current year, and shown otherwise so an aged row is not
 * mistaken for this year's.
 */
export function historyWindowRange(
  request: Pick<AccessRequestView, "leaseNotBefore" | "leaseNotAfter">,
  locale: string,
  nowMs: number,
): string {
  const start = new Date(request.leaseNotBefore);
  const end = new Date(request.leaseNotAfter);
  const thisYear = new Date(nowMs).getFullYear();
  const withYear = start.getFullYear() !== thisYear || end.getFullYear() !== thisYear;
  const cacheKey = `${locale}|${withYear}`;
  let format = rangeFormats.get(cacheKey);
  if (!format) {
    format = new Intl.DateTimeFormat(locale, {
      year: withYear ? "numeric" : undefined,
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
    rangeFormats.set(cacheKey, format);
  }
  return format.formatRange(start, end);
}

/** A localized date and time without seconds, e.g. "Oct 21, 2026, 4:12 PM". */
export function historyDateTime(iso: string, locale: string): string {
  let format = dateTimeFormats.get(locale);
  if (!format) {
    format = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
    dateTimeFormats.set(locale, format);
  }
  return format.format(new Date(iso));
}
