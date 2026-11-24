import { Observable, Subject, Subscription } from "rxjs";

import type { TabEdge } from "../types";

import { MonitoringEventKind } from "./enums";
import { monitoringEvents$ } from "./monitoring-controller.rx";
import type {
  FrameCommand,
  FrameLost,
  FrameRef,
  MonitoringControllerSources,
  MonitoringEvent,
} from "./types";
import { monitoringChange } from "./utils";

/** The key of a frame within its tab. A frame without an id is distinct from frame 0. */
const frameKey = (frameId: number | undefined): number => frameId ?? -1;

type Frame = {
  tab: chrome.tabs.Tab;
  frameId: number | undefined;
  /** The frame's open connections from injected scripts. The bootstrap and the autofiller connect separately. */
  ports: Set<chrome.runtime.Port>;
  /** Whether the frame has been told to start and not told to stop since. */
  monitoring: boolean;
};

/**
 * Decides which frames start and stop their monitors, and tracks those frames. See
 * `lifecycle/design.md`, "Routing" and "Triggers".
 *
 * A frame is known from the moment its scripts finish injecting or its first port connects. It
 * stays known until its last port disconnects, its tab is removed, or the scripts begin reloading.
 *
 * A known frame is started while its tab is in a monitoring state, and stopped when its tab
 * leaves one. The injection and the tab's change of state can arrive in either order, and the
 * later one starts the frame. A frame can be started more than once, which is harmless to its
 * monitors.
 *
 * A removed tab stays removed. Scripts that finish injecting after their tab closed create no frame.
 *
 * The controller subscribes to its sources when it is constructed, and applies their events one at
 * a time, in the order they arrive, even when applying one causes another
 * ({@link monitoringEvents$}). It updates a frame's state before it reports the frame's command or
 * loss, so a listener of either reads {@link isMonitoringFrame} for that frame as it is after the
 * event. See `patterns.md`, "The controller".
 */
export class MonitoringController implements Disposable {
  private readonly tabs = new Map<number, Map<number, Frame>>();
  private readonly monitoringTabs = new Set<number>();
  private readonly removedTabs = new Set<number>();
  private readonly ports = new Set<chrome.runtime.Port>();
  private readonly subscription: Subscription;
  private readonly pending: MonitoringEvent[] = [];
  private applying = false;

  private readonly commandIssued = new Subject<FrameCommand>();
  private readonly frameLostSubject = new Subject<FrameLost>();

  /** Each start or stop command, in the order issued. */
  readonly commands$: Observable<FrameCommand> = this.commandIssued.asObservable();

  /**
   * Each frame that no longer exists, or that no longer holds a connection: its last port
   * disconnected, or its tab was removed. No stop command is issued for a lost frame. A reload of
   * the scripts forgets every frame without reporting a loss, because the frames are still there.
   */
  readonly frameLost$: Observable<FrameLost> = this.frameLostSubject.asObservable();

  /**
   * @param sources - The events the controller reads.
   * @param onError - Called when a source fails. The controller then reads no further events and
   * keeps its current state. It is not called for an error thrown while applying an event.
   */
  constructor(sources: MonitoringControllerSources, onError: (error: unknown) => void) {
    this.subscription = monitoringEvents$(sources).subscribe({
      next: (event) => this.enqueue(event),
      error: onError,
    });
  }

  /** Whether the frame has been told to start and not told to stop since. `false` for an unknown frame. */
  isMonitoringFrame(tabId: number, frameId: number | undefined): boolean {
    return this.tabs.get(tabId)?.get(frameKey(frameId))?.monitoring ?? false;
  }

  /** Whether any frame of the tab is monitoring, as {@link isMonitoringFrame} defines it. */
  isMonitoringTab(tabId: number): boolean {
    for (const frame of this.tabs.get(tabId)?.values() ?? []) {
      if (frame.monitoring) {
        return true;
      }
    }
    return false;
  }

  /** Every known frame. */
  frames(): FrameRef[] {
    return [...this.tabs.values()].flatMap((frames) =>
      [...frames.values()].map(({ tab, frameId }) => ({ tab, frameId })),
    );
  }

  [Symbol.dispose](): void {
    this.subscription.unsubscribe();
    this.tabs.clear();
    this.monitoringTabs.clear();
    this.removedTabs.clear();
    this.ports.clear();
    this.pending.length = 0;
    this.commandIssued.complete();
    this.frameLostSubject.complete();
  }

  /**
   * Applies events one at a time. An event that arrives while another is being applied, because
   * applying it caused one, waits its turn.
   */
  private enqueue(event: MonitoringEvent): void {
    this.pending.push(event);
    if (this.applying) {
      return;
    }
    this.applying = true;
    try {
      for (let next = this.pending.shift(); next; next = this.pending.shift()) {
        this.apply(next);
      }
    } finally {
      this.applying = false;
    }
  }

  private apply(event: MonitoringEvent): void {
    switch (event.kind) {
      case MonitoringEventKind.TabChanged:
        return this.tabChanged(event.tabId, event.edge);
      case MonitoringEventKind.TabRemoved:
        return this.tabRemoved(event.tabId);
      case MonitoringEventKind.FrameInjected:
        return this.frameInjected(event.tab, event.frameId);
      case MonitoringEventKind.PortConnected:
        return this.portConnected(event.port);
      case MonitoringEventKind.PortDisconnected:
        return this.portDisconnected(event.port);
      case MonitoringEventKind.ScriptsReloading:
        return this.forgetAllFrames();
    }
  }

  /**
   * Starts the tab's known frames when the tab enters a monitoring state. Stops the frames that
   * are running when the tab leaves one.
   */
  private tabChanged(tabId: number, edge: TabEdge): void {
    const change = monitoringChange(edge);
    if (!change) {
      return;
    }

    if (change === "start") {
      this.monitoringTabs.add(tabId);
    } else {
      this.monitoringTabs.delete(tabId);
    }
    for (const frame of [...(this.tabs.get(tabId)?.values() ?? [])]) {
      if (change === "start" || frame.monitoring) {
        this.command(frame, change);
      }
    }
  }

  /** Forgets the tab and its frames, and reports each frame as lost. */
  private tabRemoved(tabId: number): void {
    this.monitoringTabs.delete(tabId);
    this.removedTabs.add(tabId);
    const frames = this.tabs.get(tabId);
    this.tabs.delete(tabId);
    for (const frame of frames?.values() ?? []) {
      this.frameLostSubject.next({ tabId, frameId: frame.frameId });
    }
  }

  /** Records the frame, and starts it if its tab is in a monitoring state. */
  private frameInjected(tab: chrome.tabs.Tab, frameId: number | undefined): void {
    if (tab.id == null || this.removedTabs.has(tab.id)) {
      return;
    }
    const frame = this.frame(tab, frameId);
    if (this.monitoringTabs.has(tab.id)) {
      this.command(frame, "start");
    }
  }

  /**
   * Records the port against its frame, and starts the frame if its tab is in a monitoring state
   * and the frame has not been started.
   *
   * A replacement document can finish injecting before the old document's last port disconnects.
   * That disconnect then removes the frame, so the new document's first port must add the frame
   * again and start it.
   */
  private portConnected(port: chrome.runtime.Port): void {
    this.ports.add(port);
    const tab = port.sender?.tab;
    if (tab?.id == null || this.removedTabs.has(tab.id)) {
      return;
    }
    const frame = this.frame(tab, port.sender?.frameId);
    frame.ports.add(port);
    if (!frame.monitoring && this.monitoringTabs.has(tab.id)) {
      this.command(frame, "start");
    }
  }

  /** Removes the port, and reports the frame as lost if it was the frame's last port. */
  private portDisconnected(port: chrome.runtime.Port): void {
    this.ports.delete(port);
    const tabId = port.sender?.tab?.id;
    if (tabId == null) {
      return;
    }
    const frames = this.tabs.get(tabId);
    const frame = frames?.get(frameKey(port.sender?.frameId));
    if (!frames || !frame) {
      return;
    }
    if (!frame.ports.delete(port) || frame.ports.size > 0) {
      return;
    }
    frames.delete(frameKey(frame.frameId));
    if (frames.size === 0) {
      this.tabs.delete(tabId);
    }
    this.frameLostSubject.next({ tabId, frameId: frame.frameId });
  }

  /**
   * Forgets every frame and disconnects every port. Reports no loss and sends no stop command. A
   * tab in a monitoring state stays in it, so a frame injected afterwards is started.
   */
  private forgetAllFrames(): void {
    const live = [...this.ports];
    this.ports.clear();
    this.tabs.clear();
    live.forEach((port) => port.disconnect());
  }

  private frame(tab: chrome.tabs.Tab, frameId: number | undefined): Frame {
    const tabId = tab.id;
    let frames = this.tabs.get(tabId);
    if (!frames) {
      frames = new Map();
      this.tabs.set(tabId, frames);
    }
    let frame = frames.get(frameKey(frameId));
    if (!frame) {
      frame = { tab, frameId, ports: new Set(), monitoring: false };
      frames.set(frameKey(frameId), frame);
    }
    frame.tab = tab;
    return frame;
  }

  private command(frame: Frame, command: "start" | "stop"): void {
    frame.monitoring = command === "start";
    this.commandIssued.next({ tab: frame.tab, frameId: frame.frameId, command });
  }
}
