import { type AccessPreCheckView, maxRequestDurationSeconds } from "@bitwarden/bit-pam";

/** The governing rule's cap, worded for its approval path. */
export interface RequestTerms {
  maxSeconds: number;
  messageKey: string;
}

/**
 * `null` when the pre-check carries no cap, rather than a made-up limit. An auto-approved request is
 * capped at what the duration picker offers, since the server reports its 365-day ceiling for a rule
 * with no cap but the picker stops well short of it. An approver-gated request picks its own window,
 * so it keeps the server's cap.
 */
export function requestTerms({
  approvalMode,
  maxDurationSeconds,
  defaultDurationSeconds,
}: Pick<
  AccessPreCheckView,
  "approvalMode" | "maxDurationSeconds" | "defaultDurationSeconds"
>): RequestTerms | null {
  if (!Number.isFinite(maxDurationSeconds)) {
    return null;
  }
  return approvalMode === "automatic"
    ? {
        maxSeconds: maxRequestDurationSeconds(maxDurationSeconds, defaultDurationSeconds),
        messageKey: "pamRequestAccessBannerMaxDurationAutomatic",
      }
    : { maxSeconds: maxDurationSeconds, messageKey: "pamRequestAccessBannerMaxDuration" };
}
