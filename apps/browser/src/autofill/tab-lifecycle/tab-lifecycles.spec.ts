import { BehaviorSubject, firstValueFrom, NEVER, of, Subject } from "rxjs";

import { TabEdgeCause, TabState } from "./enums";
import type { ObservedWindow, ReducerSources } from "./reducer";
import { feedTabLifecycles, TabLifecycles } from "./tab-lifecycles";
import type { TabEdge } from "./types";
import { isMonitoring } from "./utils";

const SETTLE_MS = 500;
const COOL_DOWN_MS = 15_000;
const timings = { settleMs$: of(SETTLE_MS), coolDownMs$: of(COOL_DOWN_MS) };

const win = (id: number, activeTabId: number, focused = false): ObservedWindow => ({
  id,
  focused,
  tabs: [{ id: activeTabId, active: true }],
});

describe("TabLifecycles", () => {
  let signedIn$: BehaviorSubject<boolean>;
  let tabActivated$: Subject<{ tabId: number; windowId: number }>;
  let tabRemoved$: Subject<{ tabId: number }>;
  let windowFocusChanged$: Subject<number>;
  let windows: ObservedWindow[];
  let getWindows: jest.Mock;
  let changes: Array<readonly [number, TabEdge]>;
  let stops: Array<() => void>;

  const advance = (ms: number) => jest.advanceTimersByTimeAsync(ms);

  /** Runs a surface over `initial` windows, with every stream subscribed first. */
  async function start(initial: ObservedWindow[], signedInAtStart = true) {
    windows = initial;
    signedIn$ = new BehaviorSubject(signedInAtStart);
    const sources: ReducerSources = {
      signedIn$,
      tabActivated$,
      tabCreated$: NEVER,
      tabRemoved$,
      tabReplaced$: NEVER,
      tabAttached$: NEVER,
      tabDetached$: NEVER,
      windowFocusChanged$,
      windowRemoved$: NEVER,
      getWindows,
      onReconcileError: jest.fn(),
    };
    const surface = new TabLifecycles(timings);
    surface.tabLifecycleChanged$.subscribe((change) => changes.push(change));
    const subscription = feedTabLifecycles(surface, sources).subscribe();
    await advance(0);
    const stop = () => {
      subscription.unsubscribe();
      surface[Symbol.dispose]();
    };
    stops.push(stop);
    return { surface, stop };
  }

  const latest = (surface: TabLifecycles) => firstValueFrom(surface.latestEdges$);

  beforeEach(() => {
    jest.useFakeTimers();
    tabActivated$ = new Subject();
    tabRemoved$ = new Subject();
    windowFocusChanged$ = new Subject();
    getWindows = jest.fn(async () => windows);
    changes = [];
    stops = [];
  });

  afterEach(() => {
    stops.forEach((stop) => stop());
    jest.useRealTimers();
  });

  it("drives each window's active tab up from the seed, and no other tab", async () => {
    const { stop } = await start([win(1, 10, true), win(2, 20)]);
    await advance(SETTLE_MS);

    expect(changes.map(([tabId, edge]) => [tabId, edge.to])).toEqual([
      [10, TabState.WarmUp],
      [20, TabState.WarmUp],
      [10, TabState.Hot],
      [20, TabState.Warm],
    ]);
    stop();
  });

  it("is not ready until the browser has been read", async () => {
    let release: () => void = () => undefined;
    getWindows.mockImplementationOnce(
      () => new Promise((resolve) => (release = () => resolve([win(1, 10, true)]))),
    );
    const { surface } = await start([]);
    const ready: unknown[] = [];
    surface.ready$.subscribe(() => ready.push(true));
    expect(ready).toEqual([]);

    release();
    await advance(0);

    expect(ready).toEqual([true]);
  });

  it("has the seed's edges in the latest edges when it is ready", async () => {
    const { surface } = await start([win(1, 10, true)]);
    await firstValueFrom(surface.ready$);

    expect((await latest(surface)).get(10)?.to).toBe(TabState.WarmUp);
  });

  it("leaves a tab the seed could not resolve cold until the browser activates it", async () => {
    getWindows.mockRejectedValueOnce(new Error("nope"));
    const { stop } = await start([win(1, 10, true)]);
    expect(changes).toEqual([]);

    tabActivated$.next({ tabId: 10, windowId: 1 });
    await advance(SETTLE_MS);

    expect(changes.map(([tabId, edge]) => [tabId, edge.to])).toEqual([
      [10, TabState.WarmUp],
      [10, TabState.Hot],
    ]);
    stop();
  });

  it("brings the latest edges up to date before it reports an edge", async () => {
    const { surface, stop } = await start([win(1, 10, true)]);
    const map = await latest(surface);
    const seen: Array<TabEdge | undefined> = [];
    surface.tabLifecycleChanged$.subscribe(([tabId]) => seen.push(map.get(tabId)));

    await advance(SETTLE_MS);

    expect(seen.map((edge) => edge?.to)).toEqual([TabState.Hot]);
    stop();
  });

  it("does not let a cool-down fire after the browser logs out", async () => {
    const { stop } = await start([win(1, 10, true)]);
    await advance(SETTLE_MS);
    tabActivated$.next({ tabId: 11, windowId: 1 });
    signedIn$.next(false);
    changes.length = 0;

    await advance(COOL_DOWN_MS);

    expect(changes).toEqual([]);
    stop();
  });

  it("is ready once the seed has been announced", async () => {
    const { surface, stop } = await start([win(1, 10, true)]);

    await expect(firstValueFrom(surface.ready$)).resolves.toBeUndefined();
    stop();
  });

  it("is ready, with every tab cold, when the browser cannot be read", async () => {
    getWindows.mockRejectedValue(new Error("nope"));

    const { surface, stop } = await start([win(1, 10, true)]);
    await advance(SETTLE_MS);

    await expect(firstValueFrom(surface.ready$)).resolves.toBeUndefined();
    expect(changes).toEqual([]);
    stop();
  });

  it("gives a tab opened while logged out no monitoring until someone signs in", async () => {
    const { stop } = await start([win(1, 10, true)], false);
    await advance(SETTLE_MS);
    expect(changes).toEqual([]);

    signedIn$.next(true);
    await advance(SETTLE_MS);

    expect(changes.map(([, edge]) => [edge.to, edge.cause])).toEqual([
      [TabState.Cold, TabEdgeCause.Login],
      [TabState.WarmUp, TabEdgeCause.Activate],
      [TabState.Hot, TabEdgeCause.Settle],
    ]);
    stop();
  });

  it("freezes every tab when the browser logs out, and thaws them on login, announcing the active tab again", async () => {
    const { stop } = await start([win(1, 10, true)]);
    tabActivated$.next({ tabId: 11, windowId: 1 });
    await advance(SETTLE_MS);
    changes.length = 0;

    signedIn$.next(false);
    signedIn$.next(true);
    await advance(SETTLE_MS);

    // Tab 10 was left cold and stays so. Tab 11 is the active tab, so the login announces it.
    expect(changes.filter(([tabId]) => tabId === 10).map(([, edge]) => edge.to)).toEqual([
      TabState.Frozen,
      TabState.Cold,
    ]);
    expect(changes.filter(([tabId]) => tabId === 11).map(([, edge]) => edge.to)).toEqual([
      TabState.Frozen,
      TabState.Cold,
      TabState.WarmUp,
      TabState.Hot,
    ]);
    stop();
  });

  it("turns a window's focus into one tab's edge and no other's", async () => {
    const { stop } = await start([win(1, 10, true), win(2, 20)]);
    await advance(SETTLE_MS);
    changes.length = 0;

    windowFocusChanged$.next(2);

    expect(changes.map(([tabId, edge]) => [tabId, edge.from, edge.to])).toEqual([
      [10, TabState.Hot, TabState.Warm],
      [20, TabState.Warm, TabState.Hot],
    ]);
    stop();
  });

  it("tears down a removed tab's machine, so no timer fires for it", async () => {
    const { stop } = await start([win(1, 10, true)]);
    tabRemoved$.next({ tabId: 10 });
    changes.length = 0;

    await advance(SETTLE_MS);

    expect(changes).toEqual([]);
    stop();
  });

  it("reports every removed tab, including one it never tracked", async () => {
    const { surface, stop } = await start([win(1, 10, true)]);
    const removed: number[] = [];
    surface.tabRemoved$.subscribe((tabId) => removed.push(tabId));

    tabRemoved$.next({ tabId: 10 });
    tabRemoved$.next({ tabId: 77 });

    expect(removed).toEqual([10, 77]);
    stop();
  });

  describe("the latest edge of each tab", () => {
    it("holds the edge a tab last had, for reading at join time", async () => {
      const { surface, stop } = await start([win(1, 10, true)]);
      await advance(SETTLE_MS);

      const edges = await latest(surface);

      expect(isMonitoring(edges.get(10)!)).toBe(true);
      expect(edges.get(10)).toEqual(
        expect.objectContaining({ to: TabState.Hot, cause: TabEdgeCause.Settle }),
      );
      stop();
    });

    it("has no entry for a tab that has not changed", async () => {
      const { surface, stop } = await start([win(1, 10, true)]);

      expect((await latest(surface)).has(99)).toBe(false);
      stop();
    });

    it("drops a removed tab", async () => {
      const { surface, stop } = await start([win(1, 10, true)]);
      await advance(SETTLE_MS);

      tabRemoved$.next({ tabId: 10 });

      expect((await latest(surface)).has(10)).toBe(false);
      stop();
    });

    it("is one map, updated in place", async () => {
      const { surface, stop } = await start([win(1, 10, true)]);
      const before = await latest(surface);

      await advance(SETTLE_MS);

      expect(await latest(surface)).toBe(before);
      stop();
    });
  });

  it("cools down a tab that is left, and stops monitoring it afterward", async () => {
    const { stop } = await start([win(1, 10, true)]);
    tabActivated$.next({ tabId: 11, windowId: 1 });
    await advance(SETTLE_MS);
    await advance(COOL_DOWN_MS);

    const final = new Map(changes.map(([tabId, edge]) => [tabId, edge]));
    expect(final.get(10)?.to).toBe(TabState.Cold);
    expect(isMonitoring(final.get(11)!)).toBe(true);
    stop();
  });
});

describe("TabLifecycles, applied directly", () => {
  let lifecycles: TabLifecycles;
  let edges: Array<readonly [number, TabEdge]>;

  beforeEach(() => {
    jest.useFakeTimers();
    lifecycles = new TabLifecycles({ settleMs$: of(SETTLE_MS), coolDownMs$: of(COOL_DOWN_MS) });
    edges = [];
    lifecycles.tabLifecycleChanged$.subscribe((edge) => edges.push(edge));
  });

  afterEach(() => {
    lifecycles[Symbol.dispose]();
    jest.useRealTimers();
  });

  const activate = (tabId: number, signedIn: boolean) =>
    lifecycles.apply({ kind: "tab", tabId, event: { kind: "activate", focused: true }, signedIn });

  it("starts the machine of a tab first heard of while signed in from cold", () => {
    activate(1, true);

    expect(edges.map(([, edge]) => [edge.from, edge.to])).toEqual([
      [TabState.Cold, TabState.WarmUp],
    ]);
  });

  it("starts the machine of a tab first heard of while signed out from frozen, so it ignores the activation", () => {
    activate(1, false);

    expect(edges).toEqual([]);
  });

  it("gives every tab that has a machine a login, and no tab that does not", () => {
    activate(1, false);
    lifecycles.apply({ kind: "all", event: { kind: "login" }, signedIn: true });

    expect(edges.map(([tabId, edge]) => [tabId, edge.to])).toEqual([[1, TabState.Cold]]);
  });

  it("ends a removed tab's machine, so its wait does not elapse", async () => {
    activate(1, true);
    lifecycles.apply({ kind: "removed", tabId: 1 });
    edges.length = 0;

    await jest.advanceTimersByTimeAsync(SETTLE_MS);

    expect(edges).toEqual([]);
  });

  it("ends every machine when disposed, and completes its streams", async () => {
    let completed = 0;
    lifecycles.tabLifecycleChanged$.subscribe({ complete: () => completed++ });
    lifecycles.tabRemoved$.subscribe({ complete: () => completed++ });
    activate(1, true);
    edges.length = 0;

    lifecycles[Symbol.dispose]();
    await jest.advanceTimersByTimeAsync(SETTLE_MS);

    expect(edges).toEqual([]);
    expect(completed).toBe(2);
  });

  it("ignores a signal after it is disposed", () => {
    lifecycles[Symbol.dispose]();

    activate(1, true);

    expect(edges).toEqual([]);
  });
});
