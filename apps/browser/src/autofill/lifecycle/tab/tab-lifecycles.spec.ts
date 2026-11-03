import { of } from "rxjs";

import { TabState } from "../enums";
import type { TabEdge } from "../types";

import { TabLifecycles } from "./tab-lifecycles";

const SETTLE_MS = 500;
const COOL_DOWN_MS = 15_000;

describe("TabLifecycles", () => {
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
