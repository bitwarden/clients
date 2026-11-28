import { mock } from "jest-mock-extended";
import { filter, Subject, switchMap, take, throwError } from "rxjs";

import { createChromeTabMock } from "../../spec/autofill-mocks";
import { TabEdgeCause, TabState } from "../enums";
import type { TabEdge } from "../types";

import { MonitoringController } from "./monitoring-controller";
import type { FrameCommand, FrameLost } from "./types";

const edge = (from: TabState, to: TabState): TabEdge => ({
  from,
  to,
  cause: TabEdgeCause.Settle,
  focused: true,
});
const settles = edge(TabState.WarmUp, TabState.Hot);
const leaves = edge(TabState.CoolDown, TabState.Cold);

const tab1 = createChromeTabMock({ id: 1 });
const tab2 = createChromeTabMock({ id: 2 });

const portFor = (tab: chrome.tabs.Tab, frameId: number | undefined) =>
  mock<chrome.runtime.Port>({ sender: { tab, frameId } });

describe("MonitoringController", () => {
  let controller: MonitoringController;
  let tabChanged$: Subject<readonly [number, TabEdge]>;
  let tabRemoved$: Subject<number>;
  let frameInjected$: Subject<{ tab: chrome.tabs.Tab; frameId: number | undefined }>;
  let portConnected$: Subject<chrome.runtime.Port>;
  let portDisconnected$: Subject<chrome.runtime.Port>;
  let scriptsReloading$: Subject<void>;
  let errors: unknown[];
  let commands: Array<[tabId: number | undefined, frameId: number | undefined, string]>;
  let lost: FrameLost[];

  beforeEach(() => {
    tabChanged$ = new Subject();
    tabRemoved$ = new Subject();
    frameInjected$ = new Subject();
    portConnected$ = new Subject();
    portDisconnected$ = new Subject();
    scriptsReloading$ = new Subject();
    errors = [];
    controller = new MonitoringController(
      {
        tabLifecycleChanged$: tabChanged$,
        tabRemoved$,
        frameInjected$,
        portConnected$,
        portDisconnected$: (port) => portDisconnected$.pipe(filter((p) => p === port)),
        scriptsReloading$,
      },
      (error) => errors.push(error),
    );
    commands = [];
    lost = [];
    controller.commands$.subscribe(({ tab, frameId, command }: FrameCommand) =>
      commands.push([tab.id, frameId, command]),
    );
    controller.frameLost$.subscribe((frame) => lost.push(frame));
  });

  afterEach(() => controller[Symbol.dispose]());

  describe("a tab starts monitoring", () => {
    it("starts each frame of the tab, and no frame of another tab", () => {
      frameInjected$.next({ tab: tab1, frameId: 0 });
      frameInjected$.next({ tab: tab1, frameId: 5 });
      frameInjected$.next({ tab: tab2, frameId: 0 });

      tabChanged$.next([1, settles]);

      expect(commands).toEqual([
        [1, 0, "start"],
        [1, 5, "start"],
      ]);
    });

    it("starts a frame that is known only by its port", () => {
      portConnected$.next(portFor(tab1, 0));

      tabChanged$.next([1, settles]);

      expect(commands).toEqual([[1, 0, "start"]]);
    });

    it("starts a frame once, though its bootstrap and autofiller each hold a port", () => {
      portConnected$.next(portFor(tab1, 0));
      portConnected$.next(portFor(tab1, 0));

      tabChanged$.next([1, settles]);

      expect(commands).toEqual([[1, 0, "start"]]);
    });

    it("starts a frame injected after the tab began, so the order of the two does not matter", () => {
      tabChanged$.next([1, settles]);

      frameInjected$.next({ tab: tab1, frameId: 0 });

      expect(commands).toEqual([[1, 0, "start"]]);
    });

    it("says nothing for an edge that leaves the tab monitoring", () => {
      frameInjected$.next({ tab: tab1, frameId: 0 });
      tabChanged$.next([1, settles]);
      commands.length = 0;

      tabChanged$.next([1, edge(TabState.Hot, TabState.CoolDown)]);
      tabChanged$.next([1, edge(TabState.CoolDown, TabState.Hot)]);

      expect(commands).toEqual([]);
    });
  });

  describe("a frame is injected", () => {
    it("is not started while its tab does not monitor", () => {
      frameInjected$.next({ tab: tab1, frameId: 0 });

      expect(commands).toEqual([]);
      expect(controller.isMonitoringFrame(1, 0)).toBe(false);
    });

    it("is started again when it is injected again, as a new document is", () => {
      tabChanged$.next([1, settles]);
      frameInjected$.next({ tab: tab1, frameId: 0 });

      frameInjected$.next({ tab: tab1, frameId: 0 });

      expect(commands).toEqual([
        [1, 0, "start"],
        [1, 0, "start"],
      ]);
    });
  });

  describe("a tab stops monitoring", () => {
    it("stops each frame that was started", () => {
      frameInjected$.next({ tab: tab1, frameId: 0 });
      frameInjected$.next({ tab: tab1, frameId: 5 });
      tabChanged$.next([1, settles]);
      commands.length = 0;

      tabChanged$.next([1, leaves]);

      expect(commands).toEqual([
        [1, 0, "stop"],
        [1, 5, "stop"],
      ]);
    });

    it("stops a frame that has no port, which a stop addressed to ports would miss", () => {
      tabChanged$.next([1, settles]);
      frameInjected$.next({ tab: tab1, frameId: 0 });
      commands.length = 0;

      tabChanged$.next([1, leaves]);

      expect(commands).toEqual([[1, 0, "stop"]]);
    });

    it("does not stop a frame that was never started", () => {
      portConnected$.next(portFor(tab1, 0));

      tabChanged$.next([1, edge(TabState.Warm, TabState.Cold)]);

      expect(commands).toEqual([]);
    });

    it("does not start a frame injected afterwards", () => {
      tabChanged$.next([1, settles]);
      tabChanged$.next([1, leaves]);

      frameInjected$.next({ tab: tab1, frameId: 0 });

      expect(commands).toEqual([]);
    });
  });

  describe("isMonitoringFrame", () => {
    it("is true for a frame from its start until its stop", () => {
      frameInjected$.next({ tab: tab1, frameId: 0 });
      expect(controller.isMonitoringFrame(1, 0)).toBe(false);

      tabChanged$.next([1, settles]);
      expect(controller.isMonitoringFrame(1, 0)).toBe(true);

      tabChanged$.next([1, leaves]);
      expect(controller.isMonitoringFrame(1, 0)).toBe(false);
    });

    it("keeps frames apart, a frame with no id from frame 0", () => {
      frameInjected$.next({ tab: tab1, frameId: 0 });
      frameInjected$.next({ tab: tab1, frameId: undefined });
      tabChanged$.next([1, settles]);
      portConnected$.next(portFor(tab1, 0));

      portDisconnected$.next(portFor(tab1, 0));

      expect(controller.isMonitoringFrame(1, undefined)).toBe(true);
    });

    it("is already true when a command is heard", () => {
      const heard: boolean[] = [];
      controller.commands$.subscribe(() => heard.push(controller.isMonitoringFrame(1, 0)));
      frameInjected$.next({ tab: tab1, frameId: 0 });

      tabChanged$.next([1, settles]);

      expect(heard).toEqual([true]);
    });
  });

  describe("isMonitoringTab", () => {
    it("is true while any frame of the tab is monitoring", () => {
      frameInjected$.next({ tab: tab1, frameId: 0 });
      frameInjected$.next({ tab: tab1, frameId: 5 });
      expect(controller.isMonitoringTab(1)).toBe(false);

      tabChanged$.next([1, settles]);
      expect(controller.isMonitoringTab(1)).toBe(true);

      tabChanged$.next([1, leaves]);
      expect(controller.isMonitoringTab(1)).toBe(false);
    });

    it("stays true while a frame monitors after another is lost", () => {
      const lost = portFor(tab1, 0);
      portConnected$.next(lost);
      portConnected$.next(portFor(tab1, 5));
      tabChanged$.next([1, settles]);

      portDisconnected$.next(lost);

      expect(controller.isMonitoringTab(1)).toBe(true);
    });

    it("is false for a tab with no frames, and does not read another tab's frames", () => {
      frameInjected$.next({ tab: tab2, frameId: 0 });
      tabChanged$.next([2, settles]);

      expect(controller.isMonitoringTab(1)).toBe(false);
      expect(controller.isMonitoringTab(2)).toBe(true);
    });
  });

  describe("tabMonitoring$", () => {
    const monitoringOf = (tabId: number) => {
      const values: boolean[] = [];
      const subscription = controller
        .tabMonitoring$(tabId)
        .subscribe((value) => values.push(value));
      return { values, subscription };
    };

    it("emits the tab's current state when subscribed, then each change", () => {
      tabChanged$.next([1, settles]);
      const { values } = monitoringOf(1);

      tabChanged$.next([1, leaves]);
      tabChanged$.next([1, settles]);

      expect(values).toEqual([true, false, true]);
    });

    // A tab with no frame has none that `isMonitoringTab` would find started.
    it("follows the tab's state, not its frames, so a tab with no frame is monitoring", () => {
      const { values } = monitoringOf(1);

      tabChanged$.next([1, settles]);

      expect(values).toEqual([false, true]);
    });

    it.each<[string, readonly [number, TabEdge]]>([
      ["an edge that leaves the tab monitoring", [1, edge(TabState.Hot, TabState.CoolDown)]],
      ["another tab's edge", [2, settles]],
    ])("emits nothing for %s", (_, change) => {
      tabChanged$.next([1, settles]);
      const { values } = monitoringOf(1);

      tabChanged$.next(change);

      expect(values).toEqual([true]);
    });

    it("emits nothing when a tab that was not monitoring is removed", () => {
      const { values } = monitoringOf(1);

      tabRemoved$.next(1);

      expect(values).toEqual([false]);
    });

    it("emits false to a subscriber of a tab that was removed", () => {
      tabChanged$.next([1, settles]);
      tabRemoved$.next(1);

      expect(monitoringOf(1).values).toEqual([false]);
    });

    it("emits false when the tab is removed, and does not complete", () => {
      tabChanged$.next([1, settles]);
      let completed = false;
      const values: boolean[] = [];
      controller.tabMonitoring$(1).subscribe({
        next: (value) => values.push(value),
        complete: () => (completed = true),
      });

      tabRemoved$.next(1);

      expect(values).toEqual([true, false]);
      expect(completed).toBe(false);
    });

    it("is already updated when a frame's start command is heard", () => {
      frameInjected$.next({ tab: tab1, frameId: 0 });
      const seen: boolean[] = [];
      controller.commands$
        .pipe(switchMap(() => controller.tabMonitoring$(1).pipe(take(1))))
        .subscribe((value) => seen.push(value));

      tabChanged$.next([1, settles]);

      expect(seen).toEqual([true]);
    });

    it("completes when the controller is disposed", () => {
      let completed = false;
      controller.tabMonitoring$(1).subscribe({ complete: () => (completed = true) });

      controller[Symbol.dispose]();

      expect(completed).toBe(true);
    });
  });

  describe("a port disconnects", () => {
    it("loses the frame with its last port, and not before", () => {
      const bootstrap = portFor(tab1, 0);
      const autofiller = portFor(tab1, 0);
      portConnected$.next(bootstrap);
      portConnected$.next(autofiller);

      portDisconnected$.next(bootstrap);
      expect(lost).toEqual([]);

      portDisconnected$.next(autofiller);
      expect(lost).toEqual([{ tabId: 1, frameId: 0 }]);
    });

    it("does not start the lost frame again with its tab", () => {
      const port = portFor(tab1, 0);
      portConnected$.next(port);
      portDisconnected$.next(port);

      tabChanged$.next([1, settles]);

      expect(commands).toEqual([]);
    });

    it("keeps a frame that was injected and never held a port", () => {
      frameInjected$.next({ tab: tab1, frameId: 0 });
      portDisconnected$.next(portFor(tab1, 0));

      expect(lost).toEqual([]);
    });

    it("ignores a port that reports no tab", () => {
      const port = mock<chrome.runtime.Port>({ sender: {} });
      portConnected$.next(port);

      portDisconnected$.next(port);

      expect(lost).toEqual([]);
    });
  });

  describe("a frame's document is replaced", () => {
    it("starts the new document when it connects after the old one's last port left", () => {
      const oldDocument = portFor(tab1, 0);
      portConnected$.next(oldDocument);
      tabChanged$.next([1, settles]);
      frameInjected$.next({ tab: tab1, frameId: 0 });
      commands.length = 0;

      portDisconnected$.next(oldDocument);
      portConnected$.next(portFor(tab1, 0));

      expect(commands).toEqual([[1, 0, "start"]]);
      expect(controller.isMonitoringFrame(1, 0)).toBe(true);
    });

    it("stops the new document when its tab stops", () => {
      const oldDocument = portFor(tab1, 0);
      portConnected$.next(oldDocument);
      tabChanged$.next([1, settles]);
      frameInjected$.next({ tab: tab1, frameId: 0 });
      portDisconnected$.next(oldDocument);
      portConnected$.next(portFor(tab1, 0));
      commands.length = 0;

      tabChanged$.next([1, leaves]);

      expect(commands).toEqual([[1, 0, "stop"]]);
    });
  });

  describe("a port connects", () => {
    it("starts a frame known only by its port when its tab already monitors", () => {
      tabChanged$.next([1, settles]);

      portConnected$.next(portFor(tab1, 0));

      expect(commands).toEqual([[1, 0, "start"]]);
    });

    it("does not start a frame that is already started", () => {
      tabChanged$.next([1, settles]);
      frameInjected$.next({ tab: tab1, frameId: 0 });
      commands.length = 0;

      portConnected$.next(portFor(tab1, 0));

      expect(commands).toEqual([]);
    });
  });

  describe("a tab is removed", () => {
    it("knows no frame injected or connected afterwards, so a late injection leaves nothing", () => {
      tabChanged$.next([1, settles]);
      tabRemoved$.next(1);

      frameInjected$.next({ tab: tab1, frameId: 0 });
      portConnected$.next(portFor(tab1, 5));

      expect(commands).toEqual([]);
      expect(controller.frames()).toEqual([]);
    });

    it("is applied after the change that caused it, so every frame the change reaches is started first", () => {
      frameInjected$.next({ tab: tab1, frameId: 0 });
      frameInjected$.next({ tab: tab1, frameId: 5 });
      controller.commands$.subscribe(({ frameId }) => {
        if (frameId === 0) {
          tabRemoved$.next(1);
        }
      });

      tabChanged$.next([1, settles]);

      expect(commands).toEqual([
        [1, 0, "start"],
        [1, 5, "start"],
      ]);
      expect(lost).toEqual([
        { tabId: 1, frameId: 0 },
        { tabId: 1, frameId: 5 },
      ]);
      expect(controller.frames()).toEqual([]);
    });

    it("loses its frames and no others, and the tab no longer starts anything", () => {
      frameInjected$.next({ tab: tab1, frameId: 0 });
      frameInjected$.next({ tab: tab1, frameId: 5 });
      frameInjected$.next({ tab: tab2, frameId: 0 });

      tabRemoved$.next(1);
      tabChanged$.next([1, settles]);

      expect(lost).toEqual([
        { tabId: 1, frameId: 0 },
        { tabId: 1, frameId: 5 },
      ]);
      expect(controller.frames().map(({ tab }) => tab.id)).toEqual([2]);
      expect(commands).toEqual([]);
    });
  });

  describe("the scripts begin reloading", () => {
    it("forgets every frame and disconnects the ports, and reports no loss, as the frames still exist", () => {
      const first = portFor(tab1, 0);
      const second = portFor(tab2, 0);
      portConnected$.next(first);
      portConnected$.next(second);

      scriptsReloading$.next();

      expect(first.disconnect).toHaveBeenCalled();
      expect(second.disconnect).toHaveBeenCalled();
      expect(lost).toEqual([]);
      expect(controller.frames()).toEqual([]);
    });

    it("leaves the tabs that monitor monitoring, so a frame injected afterwards starts", () => {
      tabChanged$.next([1, settles]);
      frameInjected$.next({ tab: tab1, frameId: 0 });
      scriptsReloading$.next();
      commands.length = 0;

      frameInjected$.next({ tab: tab1, frameId: 0 });

      expect(commands).toEqual([[1, 0, "start"]]);
    });
  });

  describe("a port", () => {
    it("is not heard to disconnect once the scripts begin reloading, so its listener is released", () => {
      const port = portFor(tab1, 0);
      portConnected$.next(port);
      scriptsReloading$.next();
      frameInjected$.next({ tab: tab1, frameId: 0 });

      portDisconnected$.next(port);

      expect(lost).toEqual([]);
      expect(controller.frames().map(({ tab }) => tab.id)).toEqual([1]);
    });

    it("is heard to disconnect once, in the order it arrived", () => {
      const port = portFor(tab1, 0);
      portConnected$.next(port);

      portDisconnected$.next(port);
      portConnected$.next(portFor(tab1, 0));
      portDisconnected$.next(port);

      expect(lost).toEqual([{ tabId: 1, frameId: 0 }]);
      expect(controller.frames()).toHaveLength(1);
    });
  });

  it("holds the frames as they were when a source fails, and reports the failure", () => {
    const failing = new MonitoringController(
      {
        tabLifecycleChanged$: new Subject<never>(),
        tabRemoved$: throwError(() => new Error("browser")),
        frameInjected$: new Subject<never>(),
        portConnected$: new Subject<never>(),
        portDisconnected$: () => new Subject<never>(),
        scriptsReloading$: new Subject<never>(),
      },
      (error) => errors.push(error),
    );

    expect(errors).toEqual([new Error("browser")]);
    failing[Symbol.dispose]();
  });

  describe("an event caused by applying another", () => {
    it("is applied after the event that caused it, so one tab's frames start together", () => {
      frameInjected$.next({ tab: tab1, frameId: 0 });
      frameInjected$.next({ tab: tab1, frameId: 5 });
      // the first frame's start causes a frame to be injected
      let injected = false;
      controller.commands$.subscribe(({ frameId }) => {
        if (frameId === 0 && !injected) {
          injected = true;
          frameInjected$.next({ tab: tab1, frameId: 9 });
        }
      });

      tabChanged$.next([1, settles]);

      expect(commands).toEqual([
        [1, 0, "start"],
        [1, 5, "start"],
        [1, 9, "start"],
      ]);
    });
  });

  it("reports nothing once disposed", () => {
    frameInjected$.next({ tab: tab1, frameId: 0 });
    controller[Symbol.dispose]();

    tabChanged$.next([1, settles]);

    expect(commands).toEqual([]);
  });
});
