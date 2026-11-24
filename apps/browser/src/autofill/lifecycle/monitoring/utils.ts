import type { TabEdge } from "../types";
import { isMonitoringState } from "../utils";

/**
 * Says whether an edge starts or stops monitoring, as `lifecycle/design.md` defines in "Triggers".
 * Returns `start` when the tab was not in a monitoring state before the edge and is after it.
 * Returns `stop` when the reverse holds. Returns `undefined` when the tab is on the same side of
 * monitoring before and after, for example when a cool-down ends in a return to warm or hot.
 */
export function monitoringChange(edge: TabEdge): "start" | "stop" | undefined {
  const was = isMonitoringState(edge.from);
  const now = isMonitoringState(edge.to);
  if (was === now) {
    return undefined;
  }
  return now ? "start" : "stop";
}
