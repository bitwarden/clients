import { defer, NEVER, Subject } from "rxjs";
import { TestScheduler } from "rxjs/testing";

import {
  awaitResolution$,
  bufferTransitionReports$,
  registerTransition,
  validateTransition,
} from "./buffer";
import { TabEdgeCause, TabState, TransitionValidity } from "./enums";
import type { BufferedTransitionReport, TabEdge } from "./types";

function edge(from: TabState, to: TabState, cause: TabEdgeCause, focused = true): TabEdge {
  return { from, to, cause, focused };
}

const warmUp = edge(TabState.Cold, TabState.WarmUp, TabEdgeCause.Activate);
const hot = edge(TabState.WarmUp, TabState.Hot, TabEdgeCause.Settle);
const hotByCommand = edge(TabState.Warm, TabState.Hot, TabEdgeCause.Command);
const cooledToCold = edge(TabState.CoolDown, TabState.Cold, TabEdgeCause.CoolDownElapsed, false);
const cold = edge(TabState.Warm, TabState.Cold, TabEdgeCause.Deactivate, false);
const warm = edge(TabState.Hot, TabState.Warm, TabEdgeCause.Blur, false);

function report(
  tabId: number,
  frameId: number | undefined,
  documentId: string,
  expiresAt = Number.MAX_SAFE_INTEGER,
): BufferedTransitionReport {
  return { tabId, frameId, documentId, stampedAt: 0, expiresAt };
}

describe("registerTransition", () => {
  const options = { now: 1_000, maxAgeMs: 500 };

  it("rejects a report without a tabId", () => {
    expect(registerTransition({ tabId: undefined, frameId: 0, documentId: "d" }, options)).toBe(
      undefined,
    );
  });

  it("rejects a report without a documentId", () => {
    expect(registerTransition({ tabId: 1, frameId: 0, documentId: undefined }, options)).toBe(
      undefined,
    );
  });

  it("rejects a report with an empty documentId", () => {
    expect(registerTransition({ tabId: 1, frameId: 0, documentId: "" }, options)).toBe(undefined);
  });

  it("admits tab 0 and frame 0", () => {
    expect(registerTransition({ tabId: 0, frameId: 0, documentId: "d" }, options)).toEqual(
      expect.objectContaining({ tabId: 0, frameId: 0 }),
    );
  });

  it("stamps the admission time and an absolute deadline", () => {
    expect(registerTransition({ tabId: 1, frameId: 2, documentId: "d" }, options)).toEqual({
      tabId: 1,
      frameId: 2,
      documentId: "d",
      stampedAt: 1_000,
      expiresAt: 1_500,
    });
  });

  it("admits a report from the top frame whose frameId is absent", () => {
    expect(registerTransition({ tabId: 1, frameId: undefined, documentId: "d" }, options)).toEqual(
      expect.objectContaining({ tabId: 1, frameId: undefined }),
    );
  });
});

describe("validateTransition", () => {
  const held = report(1, 0, "doc-a", 1_000);

  it("is Valid for a live frame showing the reported document", () => {
    expect(validateTransition(held, { documentId: "doc-a" }, 999)).toBe(TransitionValidity.Valid);
  });

  it("is Expired at the deadline", () => {
    expect(validateTransition(held, { documentId: "doc-a" }, 1_000)).toBe(
      TransitionValidity.Expired,
    );
  });

  it.each([
    ["no live frame", undefined],
    ["an unidentified live frame", { documentId: undefined }],
    ["a different document", { documentId: "doc-b" }],
  ])("is Expired before it is judged against %s", (_name, live) => {
    expect(validateTransition(held, live, 2_000)).toBe(TransitionValidity.Expired);
  });

  it("is FrameGone when there is no live frame", () => {
    expect(validateTransition(held, undefined, 0)).toBe(TransitionValidity.FrameGone);
  });

  it("is Unverifiable, not FrameGone, when the live frame has no documentId", () => {
    expect(validateTransition(held, { documentId: undefined }, 0)).toBe(
      TransitionValidity.Unverifiable,
    );
  });

  it("is DocumentChanged when the frame shows another document", () => {
    expect(validateTransition(held, { documentId: "doc-b" }, 0)).toBe(
      TransitionValidity.DocumentChanged,
    );
  });
});

describe("awaitResolution$", () => {
  let scheduler: TestScheduler;
  beforeEach(() => {
    scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
  });

  const r = report(1, 0, "d");

  function run(
    reportTime: "resolve" | "keep" | "drop",
    edges: string,
    values: Record<string, TabEdge>,
    expected: string,
    options: { frameLost?: string; expiresAt?: number } = {},
  ) {
    scheduler.run(({ cold: coldObs, expectObservable }) => {
      const held = { ...r, expiresAt: options.expiresAt ?? Number.MAX_SAFE_INTEGER };
      const result$ = awaitResolution$([held, reportTime], {
        lifecycleChanged$: () => coldObs(edges, values),
        frameLost$: () => coldObs(options.frameLost ?? "-"),
        now: () => scheduler.now(),
      });
      expectObservable(result$).toBe(expected, { r: held });
    });
  }

  it("resolves at once when the report-time action is resolve", () => {
    run("resolve", "-", {}, "(r|)");
  });

  it("completes silently when the report-time action is drop", () => {
    run("drop", "-a", { a: hot }, "|");
  });

  it("waits on keep and resolves on a resolving edge", () => {
    run("keep", "-a-b", { a: warmUp, b: hot }, "---(r|)");
  });

  it("drops on a command-caused arrival at hot", () => {
    run("keep", "-a", { a: hotByCommand }, "-|");
  });

  it("keeps waiting when the tab goes cold", () => {
    run("keep", "-a-b", { a: warmUp, b: cooledToCold }, "-");
  });

  it("drops when an edge retires the held transition", () => {
    run("keep", "-a", { a: warm }, "-|");
  });

  it("completes when its frame is lost", () => {
    run("keep", "-----", {}, "--|", { frameLost: "--a" });
  });

  it("drops at its deadline without a scheduled timer", () => {
    // deadline at 3ms; the resolving edge arrives at 5ms
    run("keep", "-----a", { a: hot }, "-----|", { expiresAt: 3 });
  });
});

describe("bufferTransitionReports$", () => {
  let scheduler: TestScheduler;
  beforeEach(() => {
    scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
  });

  type Marbles = {
    reports: string;
    reportValues: Record<string, BufferedTransitionReport>;
    /** Every tab's edges, as `[tabId, edge]`. */
    edges?: { marbles: string; values: Record<string, readonly [number, TabEdge]> };
    frameLost?: (tabId: number, frameId: number | undefined) => string;
    /** The ids of removed tabs. */
    tabRemoved?: { marbles: string; values: Record<string, number> };
    expected: string;
    expectedValues: Record<string, BufferedTransitionReport>;
  };

  function run(m: Marbles) {
    scheduler.run(({ cold: coldObs, hot: hotObs, expectObservable }) => {
      const result$ = bufferTransitionReports$({
        report$: hotObs(m.reports, m.reportValues),
        tabLifecycleChanged$: m.edges ? hotObs(m.edges.marbles, m.edges.values) : NEVER,
        frameLost$: (tabId, frameId) => coldObs(m.frameLost?.(tabId, frameId) ?? "-"),
        tabRemoved$: m.tabRemoved ? hotObs(m.tabRemoved.marbles, m.tabRemoved.values) : NEVER,
        now: () => scheduler.now(),
      });
      expectObservable(result$).toBe(m.expected, m.expectedValues);
    });
  }

  const a = report(1, 0, "a");
  const a2 = report(1, 0, "a2");
  const b = report(1, 1, "b");
  const other = report(2, 0, "o");

  it("resolves a report on a tab that is already hot", () => {
    run({
      reports: "--a",
      reportValues: { a },
      edges: { marbles: "-h", values: { h: [1, hot] } },
      expected: "--a",
      expectedValues: { a },
    });
  });

  it("keeps a report on a tab with no edge, rather than hanging or dropping it", () => {
    run({
      reports: "-a",
      reportValues: { a },
      edges: { marbles: "---h", values: { h: [1, hot] } },
      expected: "---a",
      expectedValues: { a },
    });
  });

  it("decides a report against its tab's edge at arrival", () => {
    run({
      reports: "--a",
      reportValues: { a },
      edges: { marbles: "-c--h", values: { c: [1, cold], h: [1, hot] } },
      expected: "----a",
      expectedValues: { a },
    });
  });

  it("drops a report on a tab whose position retires it", () => {
    run({
      reports: "--a",
      reportValues: { a },
      edges: { marbles: "-w--h", values: { w: [1, warm], h: [1, hot] } },
      expected: "-",
      expectedValues: {},
    });
  });

  it("supersedes the earlier report for a frame, leaving other frames alone", () => {
    run({
      reports: "-a-s-b",
      reportValues: { a, s: a2, b },
      edges: { marbles: "-------h", values: { h: [1, hot] } },
      expected: "-------(sb)",
      expectedValues: { s: a2, b },
    });
  });

  it("does not let one tab's edges resolve another tab's report", () => {
    run({
      reports: "-a-o",
      reportValues: { a, o: other },
      edges: { marbles: "-----h", values: { h: [1, hot] } },
      expected: "-----a",
      expectedValues: { a },
    });
  });

  it("ends a frame's wait on frame loss and not on anything else", () => {
    run({
      reports: "-a-b",
      reportValues: { a, b },
      edges: { marbles: "-----h", values: { h: [1, hot] } },
      frameLost: (_tab, frame) => (frame === 0 ? "---x" : "-"),
      expected: "-----b",
      expectedValues: { b },
    });
  });

  it("never emits a report past its deadline", () => {
    const expiring = report(1, 0, "e", 4);
    run({
      reports: "-a",
      reportValues: { a: expiring },
      edges: { marbles: "-----h", values: { h: [1, hot] } },
      expected: "-",
      expectedValues: {},
    });
  });

  it("completes a tab's wait when the tab is removed", () => {
    run({
      reports: "-a",
      reportValues: { a },
      edges: { marbles: "-----h", values: { h: [1, hot] } },
      tabRemoved: { marbles: "---x", values: { x: 1 } },
      expected: "-",
      expectedValues: {},
    });
  });

  it("removing one tab leaves another tab's wait alone", () => {
    run({
      reports: "-a-o",
      reportValues: { a, o: other },
      edges: { marbles: "-----(ht)", values: { h: [1, hot], t: [2, hot] } },
      tabRemoved: { marbles: "---x", values: { x: 1 } },
      expected: "-----o",
      expectedValues: { o: other },
    });
  });

  it("reads each source once, however many reports are waiting", () => {
    let edgeSubscriptions = 0;
    let removedSubscriptions = 0;
    const report$ = new Subject<BufferedTransitionReport>();
    bufferTransitionReports$({
      report$,
      tabLifecycleChanged$: defer(() => {
        edgeSubscriptions++;
        return NEVER;
      }),
      frameLost$: () => NEVER,
      tabRemoved$: defer(() => {
        removedSubscriptions++;
        return NEVER;
      }),
      now: () => 0,
    }).subscribe();

    report$.next(a);
    report$.next(b);
    report$.next(other);

    expect(edgeSubscriptions).toBe(1);
    expect(removedSubscriptions).toBe(1);
  });

  it("resolves a report held across unsynchronized subject emissions", () => {
    const report$ = new Subject<BufferedTransitionReport>();
    const tabLifecycleChanged$ = new Subject<readonly [number, TabEdge]>();
    const out: BufferedTransitionReport[] = [];
    bufferTransitionReports$({
      report$,
      tabLifecycleChanged$,
      frameLost$: () => NEVER,
      tabRemoved$: NEVER,
      now: () => 0,
    }).subscribe((v) => out.push(v));

    report$.next(a);
    expect(out).toEqual([]);
    tabLifecycleChanged$.next([1, hot]);
    expect(out).toEqual([a]);
  });
});
