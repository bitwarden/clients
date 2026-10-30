import { TabSignalReducer } from "./reducer";
import type { ObservedWindow, TabLifecycleEvent, TabSignal } from "./types";

const activate = (focused: boolean): TabLifecycleEvent => ({ kind: "activate", focused });
const deactivate: TabLifecycleEvent = { kind: "deactivate" };
const focus: TabLifecycleEvent = { kind: "focus" };
const blur: TabLifecycleEvent = { kind: "blur" };

/** The signal that delivers `event` to a tab, while someone is signed in. */
const tab = (tabId: number, event: TabLifecycleEvent): TabSignal => ({
  kind: "tab",
  tabId,
  event,
  signedIn: true,
});
const removed = (tabId: number): TabSignal => ({ kind: "removed", tabId });
const seeded: TabSignal = { kind: "seeded" };

/** A window with the given active tab, and another tab that is not active. */
const win = (id: number, activeTabId: number, focused = false): ObservedWindow => ({
  id,
  focused,
  tabs: [
    { id: activeTabId, active: true },
    { id: 999, active: false },
  ],
});

describe("TabSignalReducer", () => {
  let reducer: TabSignalReducer;
  let reported: TabSignal[];

  beforeEach(() => {
    reducer = new TabSignalReducer();
    reported = [];
  });

  describe("accounts", () => {
    it("delivers neither login nor logout for the first observation", () => {
      reducer.signals$.subscribe((signal) => reported.push(signal));

      reducer.accountChanged(true);

      expect(reported).toEqual([]);
    });

    it("delivers logout to every tab", () => {
      reducer.accountChanged(true);
      reducer.signals$.subscribe((signal) => reported.push(signal));

      reducer.accountChanged(false);

      expect(reported).toEqual([{ kind: "all", event: { kind: "logout" }, signedIn: false }]);
    });

    it("delivers login to every tab, then announces each window's active tab", () => {
      reducer.accountChanged(false);
      reducer.reconciled([win(1, 10, true), win(2, 20)]);
      reducer.signals$.subscribe((signal) => reported.push(signal));

      reducer.accountChanged(true);

      expect(reported).toEqual([
        { kind: "all", event: { kind: "login" }, signedIn: true },
        tab(10, activate(true)),
        tab(20, activate(false)),
      ]);
    });

    it("delivers one event for a crossing, however often it is restated", () => {
      reducer.accountChanged(true);
      reducer.signals$.subscribe((signal) => reported.push(signal));

      reducer.accountChanged(true);
      reducer.accountChanged(false);
      reducer.accountChanged(false);

      expect(reported).toEqual([{ kind: "all", event: { kind: "logout" }, signedIn: false }]);
    });

    it("stamps each tab event with whether anyone is signed in", () => {
      reducer.accountChanged(false);
      reducer.reconciled([win(1, 10, true)]);
      reducer.signals$.subscribe((signal) => reported.push(signal));

      reducer.accountChanged(true);
      reducer.tabActivated(11, 1);
      reducer.accountChanged(false);
      reducer.tabActivated(12, 1);

      expect(reported).toEqual([
        { kind: "all", event: { kind: "login" }, signedIn: true },
        { kind: "tab", tabId: 10, event: activate(true), signedIn: true },
        { kind: "tab", tabId: 10, event: deactivate, signedIn: true },
        { kind: "tab", tabId: 11, event: activate(true), signedIn: true },
        { kind: "all", event: { kind: "logout" }, signedIn: false },
        { kind: "tab", tabId: 11, event: deactivate, signedIn: false },
        { kind: "tab", tabId: 12, event: activate(true), signedIn: false },
      ]);
    });
  });

  describe("the seed", () => {
    it("announces each window's active tab with its window's focus, then says it is seeded", () => {
      reducer.accountChanged(true);
      reducer.signals$.subscribe((signal) => reported.push(signal));

      expect(reducer.seed()).toBe(false);
      expect(reported).toEqual([]);
      reducer.reconciled([win(1, 10, true), win(2, 20)]);

      expect(reported).toEqual([tab(10, activate(true)), tab(20, activate(false)), seeded]);
    });

    it("says it is seeded when the browser could not be read", () => {
      reducer.accountChanged(true);
      reducer.signals$.subscribe((signal) => reported.push(signal));

      reducer.seed();
      reducer.reconcileFailed();

      expect(reported).toEqual([seeded]);
    });

    it("says it is seeded once, however many reconciliations follow", () => {
      reducer.accountChanged(true);
      reducer.seed();
      reducer.reconciled([win(1, 10, true)]);
      reducer.signals$.subscribe((signal) => reported.push(signal));

      reducer.reconciled([win(1, 10, true)]);
      reducer.reconcileFailed();

      expect(reported).toEqual([]);
    });

    it("ignores a window that has no id, and a window that has no active tab", () => {
      reducer.accountChanged(true);
      reducer.signals$.subscribe((signal) => reported.push(signal));

      reducer.reconciled([
        { id: undefined, focused: false, tabs: [] },
        { id: 1, focused: true },
      ]);

      expect(reported).toEqual([]);
    });
  });

  describe("activation", () => {
    it("deactivates the window's previous tab, then activates the new one", () => {
      reducer.accountChanged(true);
      reducer.reconciled([win(1, 10, true), win(2, 20)]);
      reducer.signals$.subscribe((signal) => reported.push(signal));

      reducer.tabActivated(11, 1);

      expect(reported).toEqual([tab(10, deactivate), tab(11, activate(true))]);
    });

    it("carries the focus of a window that is not focused", () => {
      reducer.accountChanged(true);
      reducer.reconciled([win(1, 10, true), win(2, 20)]);
      reducer.signals$.subscribe((signal) => reported.push(signal));

      reducer.tabActivated(21, 2);

      expect(reported).toEqual([tab(20, deactivate), tab(21, activate(false))]);
    });

    it("reports nothing for a tab that is already its window's active tab", () => {
      reducer.accountChanged(true);
      reducer.reconciled([win(1, 10, true)]);
      reducer.signals$.subscribe((signal) => reported.push(signal));

      expect(reducer.tabActivated(10, 1)).toBe(true);

      expect(reported).toEqual([]);
    });

    it("says it could not interpret an activation in a window it has no record of, and reports nothing", () => {
      reducer.accountChanged(true);
      reducer.reconciled([win(1, 10, true)]);
      reducer.signals$.subscribe((signal) => reported.push(signal));

      expect(reducer.tabActivated(30, 3)).toBe(false);

      expect(reported).toEqual([]);
    });

    it("announces a tab created active, deactivating the tab it displaces", () => {
      reducer.accountChanged(true);
      reducer.reconciled([win(1, 10, true)]);
      reducer.signals$.subscribe((signal) => reported.push(signal));

      reducer.tabCreated({ id: 12, windowId: 1, active: true });

      expect(reported).toEqual([tab(10, deactivate), tab(12, activate(true))]);
    });

    it("announces a tab created active in a window it has no record of", () => {
      reducer.accountChanged(true);
      reducer.reconciled([win(1, 10, true)]);
      reducer.signals$.subscribe((signal) => reported.push(signal));

      expect(reducer.tabCreated({ id: 50, windowId: 5, active: true })).toBe(true);

      expect(reported).toEqual([tab(50, activate(false))]);
    });

    it("says nothing of a tab created inactive", () => {
      reducer.accountChanged(true);
      reducer.reconciled([win(1, 10, true)]);
      reducer.signals$.subscribe((signal) => reported.push(signal));

      reducer.tabCreated({ id: 12, windowId: 1, active: false });

      expect(reported).toEqual([]);
    });

    it("says nothing of a tab created without an id", () => {
      reducer.accountChanged(true);
      reducer.reconciled([win(1, 10, true)]);
      reducer.signals$.subscribe((signal) => reported.push(signal));

      reducer.tabCreated({ id: undefined, windowId: 1, active: true });

      expect(reported).toEqual([]);
    });
  });

  describe("window focus", () => {
    it("blurs the old focused window's active tab and focuses the new one's, and no other", () => {
      reducer.accountChanged(true);
      reducer.reconciled([win(1, 10, true), win(2, 20), win(3, 30)]);
      reducer.signals$.subscribe((signal) => reported.push(signal));

      reducer.windowFocusChanged(2);

      expect(reported).toEqual([tab(10, blur), tab(20, focus)]);
    });

    it("reports nothing when the focused window is focused again", () => {
      reducer.accountChanged(true);
      reducer.reconciled([win(1, 10, true), win(2, 20)]);
      reducer.signals$.subscribe((signal) => reported.push(signal));

      reducer.windowFocusChanged(1);

      expect(reported).toEqual([]);
    });

    it("focuses a tab that was activated unfocused, with no second activation", () => {
      reducer.accountChanged(true);
      reducer.reconciled([win(1, 10, true), win(2, 20)]);
      reducer.tabActivated(21, 2);
      reducer.signals$.subscribe((signal) => reported.push(signal));

      reducer.windowFocusChanged(2);

      expect(reported).toEqual([tab(10, blur), tab(21, focus)]);
    });

    it("focuses a tab that was created active unfocused, with no second activation", () => {
      reducer.accountChanged(true);
      reducer.reconciled([win(1, 10, true), win(2, 20)]);
      reducer.tabCreated({ id: 22, windowId: 2, active: true });
      reducer.signals$.subscribe((signal) => reported.push(signal));

      reducer.windowFocusChanged(2);

      expect(reported).toEqual([tab(10, blur), tab(22, focus)]);
    });

    it("reports nothing for a re-activation of the active tab in a window that just took focus", () => {
      reducer.accountChanged(true);
      reducer.reconciled([win(1, 10, true), win(2, 20)]);
      reducer.windowFocusChanged(2);
      reducer.signals$.subscribe((signal) => reported.push(signal));

      reducer.tabActivated(20, 2);

      expect(reported).toEqual([]);
    });

    it("focuses the window's previous active tab when the focus arrives before the activation, then replaces it", () => {
      reducer.accountChanged(true);
      reducer.reconciled([win(1, 10, true), win(2, 20)]);
      reducer.signals$.subscribe((signal) => reported.push(signal));

      reducer.windowFocusChanged(2);
      reducer.tabActivated(21, 2);

      expect(reported).toEqual([
        tab(10, blur),
        tab(20, focus),
        tab(20, deactivate),
        tab(21, activate(true)),
      ]);
    });

    it("says it could not interpret a focus change to a window it has no record of", () => {
      reducer.accountChanged(true);
      reducer.reconciled([win(1, 10, true)]);
      reducer.signals$.subscribe((signal) => reported.push(signal));

      expect(reducer.windowFocusChanged(4)).toBe(false);

      expect(reported).toEqual([]);
    });

    it("says it could not interpret a focus change to no window", () => {
      reducer.accountChanged(true);
      reducer.reconciled([win(1, 10, true)]);
      reducer.signals$.subscribe((signal) => reported.push(signal));

      expect(reducer.windowFocusChanged(-1)).toBe(false);

      expect(reported).toEqual([]);
    });
  });

  describe("reconciliation", () => {
    it("confirms a blur when the browser reports no window focused", () => {
      reducer.accountChanged(true);
      reducer.reconciled([win(1, 10, true), win(2, 20)]);
      reducer.signals$.subscribe((signal) => reported.push(signal));

      reducer.reconciled([win(1, 10), win(2, 20)]);

      expect(reported).toEqual([tab(10, blur)]);
    });

    it("takes a report of no focus as spurious when a window is focused after all", () => {
      reducer.accountChanged(true);
      reducer.reconciled([win(1, 10, true), win(2, 20)]);
      reducer.signals$.subscribe((signal) => reported.push(signal));

      reducer.reconciled([win(1, 10), win(2, 20, true)]);

      expect(reported).toEqual([tab(10, blur), tab(20, focus)]);
    });

    it("reports nothing when no window was focused and none is", () => {
      reducer.accountChanged(true);
      reducer.reconciled([win(1, 10), win(2, 20)]);
      reducer.signals$.subscribe((signal) => reported.push(signal));

      reducer.reconciled([win(1, 10), win(2, 20)]);

      expect(reported).toEqual([]);
    });

    it("announces a window it had no record of, and deactivates the tabs of windows that are gone", () => {
      reducer.accountChanged(true);
      reducer.reconciled([win(1, 10, true), win(2, 20), win(3, 30)]);
      reducer.signals$.subscribe((signal) => reported.push(signal));

      reducer.reconciled([win(1, 10), win(4, 40, true)]);

      expect(reported).toEqual([
        tab(10, blur),
        tab(20, deactivate),
        tab(30, deactivate),
        tab(40, activate(true)),
      ]);
    });

    it("reports only the difference between the windows it held and the windows it is given", () => {
      reducer.accountChanged(true);
      reducer.reconciled([win(1, 10, true), win(2, 20)]);
      reducer.signals$.subscribe((signal) => reported.push(signal));

      reducer.reconciled([win(1, 10, true), win(2, 21)]);

      expect(reported).toEqual([tab(20, deactivate), tab(21, activate(false))]);
    });

    it("says it could not interpret an attached tab", () => {
      expect(reducer.tabAttached()).toBe(false);
    });

    it("follows a tab that is detached from one window and attached to another", () => {
      reducer.accountChanged(true);
      reducer.reconciled([win(1, 10, true), win(2, 20)]);
      reducer.signals$.subscribe((signal) => reported.push(signal));

      reducer.tabDetached(20, 2);
      reducer.tabAttached();
      reducer.reconciled([win(1, 10, true), win(3, 20)]);

      expect(reported).toEqual([tab(20, deactivate), tab(20, activate(false))]);
    });
  });

  describe("detaching and removing", () => {
    it("deactivates a detached tab that was its window's active tab", () => {
      reducer.accountChanged(true);
      reducer.reconciled([win(1, 10, true)]);
      reducer.signals$.subscribe((signal) => reported.push(signal));

      reducer.tabDetached(10, 1);

      expect(reported).toEqual([tab(10, deactivate)]);
    });

    it("says nothing of a detached tab that was not active", () => {
      reducer.accountChanged(true);
      reducer.reconciled([win(1, 10, true)]);
      reducer.signals$.subscribe((signal) => reported.push(signal));

      reducer.tabDetached(11, 1);

      expect(reported).toEqual([]);
    });

    it("activates a replacement after a detach without deactivating again", () => {
      reducer.accountChanged(true);
      reducer.reconciled([win(1, 10, true)]);
      reducer.tabDetached(10, 1);
      reducer.signals$.subscribe((signal) => reported.push(signal));

      reducer.tabActivated(11, 1);

      expect(reported).toEqual([tab(11, activate(true))]);
    });

    it("reports a removal, and activates the replacement without deactivating the removed tab", () => {
      reducer.accountChanged(true);
      reducer.reconciled([win(1, 10, true), win(2, 20)]);
      reducer.signals$.subscribe((signal) => reported.push(signal));

      reducer.tabRemoved(20);
      reducer.tabActivated(21, 2);

      expect(reported).toEqual([removed(20), tab(21, activate(false))]);
    });

    it("reports a removal for a tab it never knew", () => {
      reducer.accountChanged(true);
      reducer.signals$.subscribe((signal) => reported.push(signal));

      reducer.tabRemoved(77);

      expect(reported).toEqual([removed(77)]);
    });

    it("says nothing more of a window whose tabs were reported removed", () => {
      reducer.accountChanged(true);
      reducer.reconciled([win(1, 10, true), win(2, 20)]);
      reducer.signals$.subscribe((signal) => reported.push(signal));

      reducer.tabRemoved(20);
      reducer.windowRemoved(2);

      expect(reported).toEqual([removed(20)]);
    });

    it("takes a later focus from nothing once the focused window is removed", () => {
      reducer.accountChanged(true);
      reducer.reconciled([win(1, 10, true), win(2, 20)]);
      reducer.tabRemoved(10);
      reducer.windowRemoved(1);
      reducer.signals$.subscribe((signal) => reported.push(signal));

      reducer.windowFocusChanged(2);

      expect(reported).toEqual([tab(20, focus)]);
    });

    it("reports a replaced tab removed, and says it could not interpret its replacement", () => {
      reducer.accountChanged(true);
      reducer.reconciled([win(1, 10, true)]);
      reducer.signals$.subscribe((signal) => reported.push(signal));

      expect(reducer.tabReplaced(10)).toBe(false);

      expect(reported).toEqual([removed(10)]);
    });
  });

  it("completes its signals when disposed", () => {
    let completed = false;
    reducer.signals$.subscribe({ complete: () => (completed = true) });

    reducer[Symbol.dispose]();

    expect(completed).toBe(true);
  });
});
