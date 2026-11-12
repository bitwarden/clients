import { describePamError, PamErrorInfo, apiErrorBodyMessage } from "../shared/pam-error-message";

/**
 * Refusals the target system endpoints send that the shared catalog does not carry. They are
 * matched here, against the server's decoded text, and replaced with a sentence written by this
 * code, so no other server text is ever printed.
 */
const TARGET_SYSTEM_REFUSALS: ReadonlyArray<{
  code: string;
  sentence: string;
  message: string;
}> = [
  {
    code: "target-system-has-rotation-configs",
    sentence: "This target system still has rotation configs.",
    message:
      "This target system still has rotation configs. Delete them first, or run `bw privileged-controls target disable` to stop new rotation jobs for it.",
  },
  {
    code: "target-system-not-sealed",
    sentence: "This target system has not been sealed yet and cannot be enabled or disabled.",
    message:
      "This target system has not been sealed yet, so it cannot be enabled or disabled. Run `bw privileged-controls target update` with the full request to finish it, or delete it.",
  },
  {
    code: "target-system-already-enabled",
    sentence: "This target system is already enabled.",
    message: "This target system is already enabled.",
  },
];

/**
 * Decodes a failure from a target system operation. It is `describePamError` plus the refusals
 * above, which only an `Api` variant error can carry. The result holds text, a kind and a variant,
 * never a payload.
 */
export function describeTargetSystemError(e: unknown): PamErrorInfo {
  const info = describePamError(e);
  if (info.variant === "Api" && e instanceof Error) {
    const body = apiErrorBodyMessage(e.message);
    const refusal =
      body == null ? undefined : TARGET_SYSTEM_REFUSALS.find((r) => body.includes(r.sentence));
    if (refusal != null) {
      return {
        kind: info.kind === "unexpected" ? "rejected" : info.kind,
        message: refusal.message,
        code: refusal.code,
        variant: info.variant,
        status: info.status,
      };
    }
  }
  return info;
}
