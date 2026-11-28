import { TabState } from "./enums";
import type { TabEdge } from "./types";

/** Whether a tab in `state` is in a monitoring state. */
export function isMonitoringState(state: TabState): boolean {
  return state === TabState.Warm || state === TabState.Hot || state === TabState.CoolDown;
}

/** Whether the tab is in a monitoring state after taking the edge. */
export function isMonitoring({ to }: TabEdge): boolean {
  return isMonitoringState(to);
}
