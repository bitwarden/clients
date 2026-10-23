export { TabState, TabEdgeCause } from "./enums";
export type { BufferAction, TabEdge, TabLifecycleEvent, TransitionReport } from "./types";
export { COOL_DOWN_MS, SETTLE_MS, tabLifecycle } from "./rx";
export {
  bufferPageTransition,
  edgeBufferAction,
  isMonitoring,
  reportBufferAction,
  resolvePageTransition,
  retirePageTransition,
} from "./utils";

export * from "./transition-buffer";
