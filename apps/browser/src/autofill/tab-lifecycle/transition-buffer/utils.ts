import type { TransitionReport } from "../types";

import { TransitionValidity } from "./enums";
import type { BufferedTransitionReport, LiveFrame } from "./types";

/**
 * Stamps a reported transition with the time it was reported and the deadline it expires at.
 *
 * Stamping fails closed: a report that belongs to no account (no `userId`), cannot be targeted
 * (no `tabId`), or cannot be validated later (no `documentId`, or an empty one) is rejected.
 *
 * @param report The facts of the transition.
 * @param options.now Epoch ms of stamping.
 * @param options.maxAgeMs How long the report stays actionable.
 * @returns The stamped report, or `undefined` if it cannot be stamped.
 */
export function registerTransition(
  report: TransitionReport,
  options: { now: number; maxAgeMs: number },
): BufferedTransitionReport | undefined {
  const { userId, tabId, frameId, documentId } = report;
  if (!userId || tabId === undefined || !documentId) {
    return undefined;
  }

  return {
    userId,
    tabId,
    frameId,
    documentId,
    stampedAt: options.now,
    expiresAt: options.now + options.maxAgeMs,
  };
}

/**
 * Decides whether a resolved transition may still be acted on.
 *
 * @param report The resolved transition.
 * @param live The frame as the browser reports it now, or `undefined` if the frame is gone.
 * @param now Epoch ms.
 */
export function validateTransition(
  report: BufferedTransitionReport,
  live: LiveFrame | undefined,
  now: number,
): TransitionValidity {
  // expiry first, so an expired report is never validated against a live frame
  if (now >= report.expiresAt) {
    return TransitionValidity.Expired;
  }
  if (live === undefined) {
    return TransitionValidity.FrameGone;
  }
  if (live.documentId === undefined) {
    return TransitionValidity.Unverifiable;
  }
  if (live.documentId !== report.documentId) {
    return TransitionValidity.DocumentChanged;
  }
  return TransitionValidity.Valid;
}

/**
 * Identifies a frame across reports.
 */
export function transitionKey(report: Pick<BufferedTransitionReport, "tabId" | "frameId">): string {
  return `${report.tabId}:${report.frameId ?? -1}`;
}
