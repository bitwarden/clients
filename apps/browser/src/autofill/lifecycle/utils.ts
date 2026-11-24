import { TabState } from "./enums";
import type { TabEdge } from "./types";

/** Whether a tab monitors once it has taken this edge. */
export function isMonitoring({ to }: TabEdge): boolean {
  return to === TabState.Warm || to === TabState.Hot || to === TabState.CoolDown;
}
