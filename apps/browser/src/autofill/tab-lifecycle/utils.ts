import { TabEdgeCause, TabState } from "./enums";
import type { BufferAction, TabEdge } from "./types";

/**
 * The questions the lifecycle asks of each edge the machine reports.
 *
 * See `lifecycle.design.md` — "The tab lifecycle" for what monitoring follows, and "Buffering
 * transitions" for what the buffer answers mean.
 */

/** The states that hold a reported page transition. */
function holdsPageTransition(state: TabState): boolean {
  return state === TabState.Cold || state === TabState.WarmUp || state === TabState.CoolDown;
}

/** Whether a tab monitors once it has taken this edge. */
export function isMonitoring({ to }: TabEdge): boolean {
  return to === TabState.Warm || to === TabState.Hot || to === TabState.CoolDown;
}

/** Whether this edge retires a held page transition. */
export function retirePageTransition({ from }: TabEdge): boolean {
  return !holdsPageTransition(from);
}

/** Whether this edge keeps a held page transition waiting. */
export function bufferPageTransition({ to }: TabEdge): boolean {
  return holdsPageTransition(to);
}

/** Whether this edge resolves a held page transition into a fill opportunity. */
export function resolvePageTransition({ to }: TabEdge): boolean {
  return to === TabState.Hot;
}

/**
 * What to do with a page transition reported after `edge`. Pass `undefined` when the machine has
 * not reported one for the tab yet.
 */
export function reportBufferAction(edge: TabEdge | undefined): BufferAction {
  if (edge === undefined) {
    return "keep";
  }
  if (resolvePageTransition(edge)) {
    return "resolve";
  }
  return bufferPageTransition(edge) ? "keep" : "drop";
}

/** What to do with a page transition already held when `edge` arrives. */
export function edgeBufferAction(edge: TabEdge): BufferAction {
  if (retirePageTransition(edge)) {
    return "drop";
  }
  if (resolvePageTransition(edge)) {
    return edge.cause === TabEdgeCause.Command ? "drop" : "resolve";
  }
  if (!bufferPageTransition(edge)) {
    return "drop";
  }
  return "keep";
}
