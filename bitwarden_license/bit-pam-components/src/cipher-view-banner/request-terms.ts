import { type AccessPreCheckView, maxRequestDurationSeconds } from "@bitwarden/bit-pam";

/** The governing rule's cap, worded for its approval path. */
export interface RequestTerms {
  maxSeconds: number;
  messageKey: string;
}

/**
 * `null` when the pre-check carries no cap. Auto-approved requests are capped at the longest duration
 * the picker offers.
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
        messageKey: "pamRequestAccessBannerMaxDurationInstantApproval",
      }
    : { maxSeconds: maxDurationSeconds, messageKey: "pamRequestAccessBannerMaxDuration" };
}
