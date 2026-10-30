import { Observable } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";

import { TabEdgeCause, TabState } from "../enums";
import type { TabEdge } from "../types";

import { DefaultTransitionBuffer } from "./default";
import type { BufferedTransitionReport } from "./types";

function edge(from: TabState, to: TabState, cause: TabEdgeCause, focused = true): TabEdge {
  return { from, to, cause, focused };
}

const hot = edge(TabState.WarmUp, TabState.Hot, TabEdgeCause.Settle);
const hotByCommand = edge(TabState.WarmUp, TabState.Hot, TabEdgeCause.Command);
const cooledToCold = edge(TabState.CoolDown, TabState.Cold, TabEdgeCause.CoolDownElapsed, false);
const warm = edge(TabState.Hot, TabState.Warm, TabEdgeCause.Blur, false);

const userId = "user-1" as UserId;

function report(
  tabId: number,
  frameId: number | undefined,
  documentId: string,
  expiresAt = Number.MAX_SAFE_INTEGER,
  stampedAt = 0,
): BufferedTransitionReport {
  return { userId, tabId, frameId, documentId, stampedAt, expiresAt };
}

describe("DefaultTransitionBuffer", () => {
  let now: number;
  let buffer: DefaultTransitionBuffer;
  let resolved: string[];
  let changes: string[][];

  beforeEach(() => {
    now = 0;
    buffer = new DefaultTransitionBuffer(() => now);
    resolved = [];
    changes = [];
    buffer.resolved$.subscribe((r) => resolved.push(r.documentId));
    // each emission is the same map, so it is recorded as it is at that moment
    buffer.buffered$.subscribe((b) => changes.push([...b.values()].map((r) => r.documentId)));
    buffer.setEnabled(true);
    changes = [];
  });

  const buffered = () => [...buffer.buffered.values()].map((r) => r.documentId);

  describe("report", () => {
    it("buffers a report on a tab with no lifecycle state yet", () => {
      buffer.report(report(1, 0, "a"));

      expect(buffered()).toEqual(["a"]);
      expect(changes).toEqual([["a"]]);
    });

    it("resolves a report on a hot tab without buffering it", () => {
      buffer.lifecycleChanged(1, hot);

      buffer.report(report(1, 0, "a"));

      expect(resolved).toEqual(["a"]);
      expect(buffered()).toEqual([]);
      expect(changes).toEqual([]);
    });

    it("drops a report on a tab whose lifecycle state drops it", () => {
      buffer.lifecycleChanged(1, warm);

      buffer.report(report(1, 0, "a"));

      expect(buffered()).toEqual([]);
      expect(resolved).toEqual([]);
    });

    it("drops a report that has already expired", () => {
      now = 10;

      buffer.report(report(1, 0, "a", 10));

      expect(buffered()).toEqual([]);
    });

    it("does not resolve a report that has already expired on a hot tab", () => {
      buffer.lifecycleChanged(1, hot);
      now = 10;

      buffer.report(report(1, 0, "a", 10));

      expect(resolved).toEqual([]);
    });

    it("replaces the frame's buffered report, leaving other frames alone", () => {
      buffer.report(report(1, 0, "a"));
      buffer.report(report(1, 1, "b"));

      buffer.report(report(1, 0, "a2"));

      expect(buffered()).toEqual(["b", "a2"]);
    });

    it("unbuffers the report it replaces even when it is dropped itself", () => {
      buffer.report(report(1, 0, "a"));
      now = 10;

      buffer.report(report(1, 0, "expired", 10, 1));

      expect(buffered()).toEqual([]);
      expect(changes.at(-1)).toEqual([]);
    });

    it("ignores a report older than the last one for its frame", () => {
      buffer.report(report(1, 0, "newer", Number.MAX_SAFE_INTEGER, 5));

      buffer.report(report(1, 0, "older", Number.MAX_SAFE_INTEGER, 1));

      expect(buffered()).toEqual(["newer"]);
      expect(changes).toEqual([["newer"]]);
    });

    it("lets a report stamped the same as the last one replace it", () => {
      buffer.report(report(1, 0, "first", Number.MAX_SAFE_INTEGER, 5));

      buffer.report(report(1, 0, "second", Number.MAX_SAFE_INTEGER, 5));

      expect(buffered()).toEqual(["second"]);
    });
  });

  describe("lifecycleChanged", () => {
    it("resolves a buffered report when its tab goes hot, unbuffering it first", () => {
      buffer.report(report(1, 0, "a"));
      const order: string[] = [];
      buffer.buffered$.subscribe(() => order.push("buffered"));
      buffer.resolved$.subscribe(() => order.push("resolved"));

      buffer.lifecycleChanged(1, hot);

      expect(resolved).toEqual(["a"]);
      expect(buffered()).toEqual([]);
      expect(order).toEqual(["buffered", "resolved"]);
    });

    it("drops a buffered report on a command-caused arrival at hot", () => {
      buffer.report(report(1, 0, "a"));

      buffer.lifecycleChanged(1, hotByCommand);

      expect(resolved).toEqual([]);
      expect(buffered()).toEqual([]);
    });

    it("keeps a buffered report when its tab goes cold", () => {
      buffer.report(report(1, 0, "a"));

      buffer.lifecycleChanged(1, cooledToCold);

      expect(buffered()).toEqual(["a"]);
      expect(changes).toEqual([["a"]]);
    });

    it("drops a buffered report when its tab's lifecycle state drops it", () => {
      buffer.report(report(1, 0, "a"));

      buffer.lifecycleChanged(1, warm);

      expect(buffered()).toEqual([]);
    });

    it("drops a buffered report that expired while it waited", () => {
      buffer.report(report(1, 0, "a", 10));
      now = 10;

      buffer.lifecycleChanged(1, hot);

      expect(resolved).toEqual([]);
      expect(buffered()).toEqual([]);
    });

    it("leaves other tabs' reports alone", () => {
      buffer.report(report(1, 0, "a"));
      buffer.report(report(2, 0, "o"));

      buffer.lifecycleChanged(1, hot);

      expect(resolved).toEqual(["a"]);
      expect(buffered()).toEqual(["o"]);
    });

    it("emits nothing when no buffered report changes", () => {
      buffer.report(report(1, 0, "a"));
      changes = [];

      buffer.lifecycleChanged(2, hot);

      expect(changes).toEqual([]);
    });
  });

  describe("frameLost", () => {
    it("drops only that frame's report, and emits", () => {
      buffer.report(report(1, 0, "a"));
      buffer.report(report(1, 1, "b"));
      changes = [];

      buffer.frameLost(1, 0);

      expect(buffered()).toEqual(["b"]);
      expect(changes).toEqual([["b"]]);
    });

    it("drops the top frame's report", () => {
      buffer.report(report(1, undefined, "top"));

      buffer.frameLost(1, undefined);

      expect(buffered()).toEqual([]);
    });

    it("emits nothing when the frame holds no report", () => {
      buffer.report(report(1, 0, "a"));
      changes = [];

      buffer.frameLost(1, 1);

      expect(changes).toEqual([]);
    });
  });

  describe("tabRemoved", () => {
    it("drops that tab's reports, leaves other tabs alone, and emits once", () => {
      buffer.report(report(1, 0, "a"));
      buffer.report(report(1, 1, "b"));
      buffer.report(report(2, 0, "o"));
      changes = [];

      buffer.tabRemoved(1);

      expect(buffered()).toEqual(["o"]);
      expect(changes).toEqual([["o"]]);
    });

    it("emits nothing when the tab holds no report", () => {
      buffer.report(report(2, 0, "o"));
      changes = [];

      buffer.tabRemoved(1);

      expect(changes).toEqual([]);
    });

    it("forgets the order of the tab's reports, and only that tab's", () => {
      buffer.report(report(1, 0, "one", Number.MAX_SAFE_INTEGER, 5));
      buffer.report(report(10, 0, "ten", Number.MAX_SAFE_INTEGER, 5));

      buffer.tabRemoved(1);
      buffer.report(report(1, 0, "one-again", Number.MAX_SAFE_INTEGER, 1));
      buffer.report(report(10, 0, "ten-older", Number.MAX_SAFE_INTEGER, 1));

      expect(buffered()).toEqual(["ten", "one-again"]);
    });

    it("forgets the tab's lifecycle state", () => {
      buffer.lifecycleChanged(1, hot);
      buffer.tabRemoved(1);

      buffer.report(report(1, 0, "a"));

      expect(resolved).toEqual([]);
      expect(buffered()).toEqual(["a"]);
    });
  });

  describe("setEnabled", () => {
    it("is disabled until enabled: it buffers nothing", () => {
      const fresh = new DefaultTransitionBuffer(() => now);

      fresh.report(report(1, 0, "a"));

      expect(fresh.buffered.size).toBe(0);
    });

    it("is disabled until enabled: it resolves nothing", () => {
      const fresh = new DefaultTransitionBuffer(() => now);
      const freshResolved: BufferedTransitionReport[] = [];
      fresh.resolved$.subscribe((r) => freshResolved.push(r));
      fresh.lifecycleChanged(1, hot);

      fresh.report(report(1, 0, "a"));

      expect(freshResolved).toEqual([]);
    });

    it("clears on false", () => {
      buffer.report(report(1, 0, "a"));
      buffer.report(report(1, 1, "b"));

      buffer.setEnabled(false);

      expect(buffered()).toEqual([]);
      expect(changes.at(-1)).toEqual([]);
    });

    it("while disabled, buffers nothing", () => {
      buffer.setEnabled(false);

      buffer.report(report(1, 0, "a"));

      expect(buffered()).toEqual([]);
    });

    it("while disabled, resolves nothing", () => {
      buffer.lifecycleChanged(1, hot);
      buffer.setEnabled(false);

      buffer.report(report(1, 0, "a"));

      expect(resolved).toEqual([]);
    });

    it("buffers again once enabled", () => {
      buffer.setEnabled(false);
      buffer.setEnabled(true);

      buffer.report(report(1, 0, "a"));

      expect(buffered()).toEqual(["a"]);
    });

    it("emits on false even when nothing is buffered", () => {
      buffer.setEnabled(false);

      expect(changes).toEqual([[]]);
    });

    it("does not resolve a report that was buffered before a clear", () => {
      buffer.report(report(1, 0, "before"));

      buffer.setEnabled(false);
      buffer.setEnabled(true);
      buffer.lifecycleChanged(1, hot);

      expect(resolved).toEqual([]);
    });

    it("forgets the order of reports from before a clear", () => {
      buffer.report(report(1, 0, "before", Number.MAX_SAFE_INTEGER, 5));

      buffer.setEnabled(false);
      buffer.setEnabled(true);
      buffer.report(report(1, 0, "after", Number.MAX_SAFE_INTEGER, 1));

      expect(buffered()).toEqual(["after"]);
    });

    it("keeps tab lifecycle states through a clear", () => {
      buffer.lifecycleChanged(1, hot);

      buffer.setEnabled(false);
      buffer.setEnabled(true);
      buffer.report(report(1, 0, "a"));

      expect(resolved).toEqual(["a"]);
    });
  });

  it("emits the same map each time, updated in place", () => {
    const maps: ReadonlyMap<string, BufferedTransitionReport>[] = [];
    buffer.buffered$.subscribe((b) => maps.push(b));

    buffer.report(report(1, 0, "a"));
    buffer.report(report(1, 1, "b"));

    expect(maps[1]).toBe(maps[0]);
    expect(maps[0]).toBe(buffer.buffered);
  });

  describe("[Symbol.dispose]", () => {
    it.each<[string, (b: DefaultTransitionBuffer) => Observable<unknown>]>([
      ["buffered$", (b) => b.buffered$],
      ["resolved$", (b) => b.resolved$],
    ])("completes %s", (_name, observable) => {
      let completed = false;
      observable(buffer).subscribe({ complete: () => (completed = true) });

      buffer[Symbol.dispose]();

      expect(completed).toBe(true);
    });
  });
});
