import { TabEdgeCause, TabState } from "../enums";
import type { TabEdge } from "../types";

import { BufferAction } from "./enums";

/**
 * The questions the controller asks of each edge the machine reports. See `model.md`, "Semantics",
 * and `lifecycle/design.md`, "Buffering transitions", for what the answers mean.
 */

/** The states that hold a reported page transition. */
function holdsPageTransition(state: TabState): boolean {
  return state === TabState.Cold || state === TabState.WarmUp || state === TabState.CoolDown;
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
    return BufferAction.Buffer;
  }
  if (resolvePageTransition(edge)) {
    return BufferAction.Resolve;
  }
  return bufferPageTransition(edge) ? BufferAction.Buffer : BufferAction.Drop;
}

/** What to do with a page transition already held when `edge` arrives. */
export function edgeBufferAction(edge: TabEdge): BufferAction {
  if (retirePageTransition(edge)) {
    return BufferAction.Drop;
  }
  if (resolvePageTransition(edge)) {
    return edge.cause === TabEdgeCause.Command ? BufferAction.Drop : BufferAction.Resolve;
  }
  if (!bufferPageTransition(edge)) {
    return BufferAction.Drop;
  }
  return BufferAction.Buffer;
}
