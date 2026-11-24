import type { Observable } from "rxjs";

import type { TabEdge } from "../types";

/** A frame in a tab. */
export type FrameRef = Readonly<{
  tab: chrome.tabs.Tab;
  /** The browser's frame id. A frame without an id is distinct from frame 0. */
  frameId: number | undefined;
}>;

/** A command to start or stop the monitors in one frame. */
export type FrameCommand = FrameRef & Readonly<{ command: "start" | "stop" }>;

/** A frame the controller no longer tracks. */
export type FrameLost = Readonly<{ tabId: number; frameId: number | undefined }>;

/** The events a `MonitoringController` reads. It subscribes to each stream once, and to `portDisconnected$` once for each port. */
export type MonitoringControllerSources = Readonly<{
  /** Each state change of each tab (e.g from `TabLifecycles.tabLifecycleChanged$`). */
  tabLifecycleChanged$: Observable<readonly [tabId: number, edge: TabEdge]>;
  /** The id of each removed tab, from `TabLifecycles.tabRemoved$`. */
  tabRemoved$: Observable<number>;
  /** Each frame whose scripts have finished injecting. */
  frameInjected$: Observable<FrameRef>;
  /** Each port opened by the extension's injected scripts. The caller selects them by port name. */
  portConnected$: Observable<chrome.runtime.Port>;
  /**
   * Emits when the script at the other end of the port disconnects. The controller subscribes when
   * the port connects, and takes the first emission.
   */
  portDisconnected$: (port: chrome.runtime.Port) => Observable<unknown>;
  /**
   * Emits when the extension is about to inject its scripts into every frame anew, as after the
   * user signs in or the inline menu setting changes. The scripts in place are replaced, so the controller forgets every
   * frame and disconnects every port.
   */
  scriptsReloading$: Observable<unknown>;
}>;

/** An event the controller applies. See `monitoringEvents$`. */
export type MonitoringEvent =
  | Readonly<{ kind: "tabChanged"; tabId: number; edge: TabEdge }>
  | Readonly<{ kind: "tabRemoved"; tabId: number }>
  | Readonly<{ kind: "frameInjected"; tab: chrome.tabs.Tab; frameId: number | undefined }>
  | Readonly<{ kind: "portConnected"; port: chrome.runtime.Port }>
  | Readonly<{ kind: "portDisconnected"; port: chrome.runtime.Port }>
  | Readonly<{ kind: "scriptsReloading" }>;
