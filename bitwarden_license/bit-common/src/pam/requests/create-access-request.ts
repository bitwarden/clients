import type { AccessPreCheckView, AccessRequestCreateRequest } from "@bitwarden/sdk-internal";

import { parseIsoDate } from "../shared/pam-dates";
import { parseDuration } from "../shared/pam-duration";
import { PamInputError } from "../shared/pam-input-error";
import { validateWindow } from "../shared/pam-window";

/** The raw flags of `request create`. Text, so the parsing and the refusals live in one place. */
export interface CreateAccessRequestInput {
  duration?: string;
  start?: string;
  end?: string;
}

/** What the flags asked for, once they are parsed and known to be consistent with each other. */
export type CreateRequestShape =
  | { kind: "none" }
  | { kind: "duration"; seconds: number }
  | { kind: "window"; start: Date; end: Date };

/**
 * Parses the flags and refuses a mixed or half-given shape before any request is made: `--duration`
 * cannot be combined with `--start` or `--end`, and `--start` and `--end` come as a pair.
 * @throws PamInputError when the flags are mixed, half-given, or not valid values.
 */
export function parseCreateShape(input: CreateAccessRequestInput): CreateRequestShape {
  const hasDuration = input.duration != null;
  const hasStart = input.start != null;
  const hasEnd = input.end != null;

  if (hasDuration && (hasStart || hasEnd)) {
    throw new PamInputError("Give either --duration or a window with --start and --end, not both.");
  }
  if (hasStart !== hasEnd) {
    throw new PamInputError("Give --start and --end together.");
  }
  if (hasDuration) {
    return { kind: "duration", seconds: parseDuration(input.duration, "--duration") };
  }
  if (hasStart && hasEnd) {
    return {
      kind: "window",
      start: parseIsoDate(input.start, "--start"),
      end: parseIsoDate(input.end, "--end"),
    };
  }
  return { kind: "none" };
}

/** The request to send and what to tell the operator about it. */
export interface CreateRequestPlan {
  request: AccessRequestCreateRequest;
  approvalMode: "automatic" | "human";
  /**
   * True on the automatic path while another member holds the item's single active lease. A hint:
   * the request is still sent, and the server decides at activation. It never names the holder.
   */
  slotBusy: boolean;
}

/**
 * Chooses the path from the pre-check and builds the SDK request, validating everything the
 * server would refuse that can be known locally.
 *
 * - Automatic: needs a duration. Without `--duration` the pre-check's default is used, never
 *   above its maximum. An explicit duration above the maximum is refused rather than quietly
 *   shortened.
 * - Human: needs a window and a reason. The window is checked with {@link validateWindow}
 *   against the pre-check's maximum.
 *
 * @param reason The trimmed reason, if one was given. Never logged or echoed.
 * @throws PamInputError when the flags do not fit the path the pre-check chose.
 */
export function planCreateRequest(
  shape: CreateRequestShape,
  reason: string | undefined,
  preCheck: AccessPreCheckView,
  now: Date = new Date(),
): CreateRequestPlan {
  if (preCheck.hasActiveLease) {
    throw new PamInputError("You already have active access to this item. No request is needed.");
  }

  if (preCheck.approvalMode === "automatic") {
    if (shape.kind === "window") {
      throw new PamInputError(
        "This item is approved automatically. Give --duration, not --start and --end.",
      );
    }
    const maxSeconds = preCheck.maxDurationSeconds;
    let seconds: number;
    if (shape.kind === "duration") {
      if (shape.seconds > maxSeconds) {
        throw new PamInputError(
          `The duration cannot be longer than ${maxSeconds} seconds for this item.`,
        );
      }
      seconds = shape.seconds;
    } else {
      seconds = Math.min(preCheck.defaultDurationSeconds, maxSeconds);
    }
    if (!Number.isSafeInteger(seconds) || seconds <= 0) {
      throw new PamInputError("No usable duration is available for this item. Give --duration.");
    }
    return {
      approvalMode: "automatic",
      slotBusy: !preCheck.canStartLease,
      request: { durationSeconds: seconds, start: undefined, end: undefined, reason },
    };
  }

  if (preCheck.approvalMode === "human") {
    if (shape.kind === "duration") {
      throw new PamInputError(
        "This item requires human approval. Give --start and --end, not --duration.",
      );
    }
    if (shape.kind === "none") {
      throw new PamInputError("This item requires human approval. Give --start and --end.");
    }
    if (reason == null) {
      throw new PamInputError(
        "A reason is required for items that need human approval. Give it with --reason, --reasonfile or --reasonstdin.",
      );
    }
    const window = validateWindow(shape.start, shape.end, {
      now,
      maxSeconds: preCheck.maxDurationSeconds,
    });
    return {
      approvalMode: "human",
      slotBusy: false,
      request: {
        durationSeconds: undefined,
        start: window.start.toISOString(),
        end: window.end.toISOString(),
        reason,
      },
    };
  }

  throw new PamInputError(
    "This item's approval mode is not recognized by this version of the CLI. Update the CLI and try again.",
  );
}
