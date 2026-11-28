/** What happened to the frames' environment, as the monitoring controller applies it. */
export const MonitoringEventKind = Object.freeze({
  /** A tab changed state. */
  TabChanged: "tabChanged",
  /** A tab was removed. */
  TabRemoved: "tabRemoved",
  /** A frame's scripts finished injecting. */
  FrameInjected: "frameInjected",
  /** A script injected into a frame connected. */
  PortConnected: "portConnected",
  /** The other end of a connection disconnected. */
  PortDisconnected: "portDisconnected",
  /** The autofill scripts are about to be injected into every frame anew. */
  ScriptsReloading: "scriptsReloading",
} as const);
export type MonitoringEventKind = (typeof MonitoringEventKind)[keyof typeof MonitoringEventKind];
