import type { AccessPreCheckView } from "@bitwarden/bit-pam";

/** The governing rule's cap, worded for its approval path. */
export interface RequestTerms {
  maxSeconds: number;
  messageKey: string;
}

/** `null` when the pre-check carries no cap, rather than a made-up limit. */
export function requestTerms({
  approvalMode,
  maxDurationSeconds,
}: Pick<AccessPreCheckView, "approvalMode" | "maxDurationSeconds">): RequestTerms | null {
  return Number.isFinite(maxDurationSeconds)
    ? {
        maxSeconds: maxDurationSeconds,
        messageKey:
          approvalMode === "automatic"
            ? "pamRequestAccessBannerMaxDurationAutomatic"
            : "pamRequestAccessBannerMaxDuration",
      }
    : null;
}
