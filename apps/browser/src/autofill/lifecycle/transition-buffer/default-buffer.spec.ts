import { Observable } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";

import { DefaultTransitionBuffer } from "./default-buffer";
import type { BufferedTransitionReport } from "./types";

/** The URL of the tab whose document reported; distinct for each document. */
const urlOf = (documentId: string) => `https://${documentId}.example/`;

const userId = "user-1" as UserId;

function report(
  tabId: number,
  frameId: number | undefined,
  documentId: string,
  expiresAt = Number.MAX_SAFE_INTEGER,
  stampedAt = 0,
): BufferedTransitionReport {
  return { userId, tabId, frameId, documentId, url: urlOf(documentId), stampedAt, expiresAt };
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

  describe("buffer", () => {
    it("buffers a report", () => {
      buffer.buffer(report(1, 0, "a"));

      expect(buffered()).toEqual(["a"]);
      expect(changes).toEqual([["a"]]);
    });

    it("does not store a report that has already expired", () => {
      now = 10;

      buffer.buffer(report(1, 0, "a", 10));

      expect(buffered()).toEqual([]);
    });

    it("replaces the frame's buffered report, leaving other frames alone", () => {
      buffer.buffer(report(1, 0, "a"));
      buffer.buffer(report(1, 1, "b"));

      buffer.buffer(report(1, 0, "a2"));

      expect(buffered()).toEqual(["b", "a2"]);
    });

    it("unbuffers the report it replaces even when it is not stored itself", () => {
      buffer.buffer(report(1, 0, "a"));
      now = 10;

      buffer.buffer(report(1, 0, "expired", 10, 1));

      expect(buffered()).toEqual([]);
      expect(changes.at(-1)).toEqual([]);
    });

    it("ignores a report older than the last one for its frame", () => {
      buffer.buffer(report(1, 0, "newer", Number.MAX_SAFE_INTEGER, 5));

      buffer.buffer(report(1, 0, "older", Number.MAX_SAFE_INTEGER, 1));

      expect(buffered()).toEqual(["newer"]);
      expect(changes).toEqual([["newer"]]);
    });

    it("lets a report stamped the same as the last one replace it", () => {
      buffer.buffer(report(1, 0, "first", Number.MAX_SAFE_INTEGER, 5));

      buffer.buffer(report(1, 0, "second", Number.MAX_SAFE_INTEGER, 5));

      expect(buffered()).toEqual(["second"]);
    });
  });

  describe("resolve", () => {
    it("resolves each of a tab's buffered reports, unbuffering them first", () => {
      buffer.buffer(report(1, 0, "a"));
      buffer.buffer(report(1, 1, "b"));
      const order: string[] = [];
      buffer.buffered$.subscribe(() => order.push("buffered"));
      buffer.resolved$.subscribe(() => order.push("resolved"));

      buffer.resolve(1);

      expect(resolved).toEqual(["a", "b"]);
      expect(buffered()).toEqual([]);
      expect(order).toEqual(["buffered", "resolved", "resolved"]);
    });

    it("leaves other tabs' reports alone", () => {
      buffer.buffer(report(1, 0, "a"));
      buffer.buffer(report(2, 0, "o"));

      buffer.resolve(1);

      expect(resolved).toEqual(["a"]);
      expect(buffered()).toEqual(["o"]);
    });

    it("drops a report that expired while it waited, instead of resolving it", () => {
      buffer.buffer(report(1, 0, "a", 10));
      buffer.buffer(report(1, 1, "b"));
      now = 10;

      buffer.resolve(1);

      expect(resolved).toEqual(["b"]);
      expect(buffered()).toEqual([]);
    });

    it("emits nothing when the tab holds no report", () => {
      buffer.buffer(report(1, 0, "a"));
      changes = [];

      buffer.resolve(2);

      expect(resolved).toEqual([]);
      expect(changes).toEqual([]);
    });
  });

  describe("drop", () => {
    it("drops a tab's reports without resolving them, leaves other tabs alone, and emits once", () => {
      buffer.buffer(report(1, 0, "a"));
      buffer.buffer(report(1, 1, "b"));
      buffer.buffer(report(2, 0, "o"));
      changes = [];

      buffer.drop(1);

      expect(resolved).toEqual([]);
      expect(buffered()).toEqual(["o"]);
      expect(changes).toEqual([["o"]]);
    });

    it("emits nothing when the tab holds no report", () => {
      buffer.buffer(report(2, 0, "o"));
      changes = [];

      buffer.drop(1);

      expect(changes).toEqual([]);
    });

    it("keeps which of the tab's reports are older, so a late older report is still ignored", () => {
      buffer.buffer(report(1, 0, "newer", Number.MAX_SAFE_INTEGER, 5));

      buffer.drop(1);
      buffer.buffer(report(1, 0, "older", Number.MAX_SAFE_INTEGER, 1));

      expect(buffered()).toEqual([]);
    });
  });

  describe("dropFrame", () => {
    it("drops only that frame's report, and emits", () => {
      buffer.buffer(report(1, 0, "a"));
      buffer.buffer(report(1, 1, "b"));
      changes = [];

      buffer.dropFrame(1, 0);

      expect(buffered()).toEqual(["b"]);
      expect(changes).toEqual([["b"]]);
    });

    it("drops the top frame's report", () => {
      buffer.buffer(report(1, undefined, "top"));

      buffer.dropFrame(1, undefined);

      expect(buffered()).toEqual([]);
    });

    it("emits nothing when the frame holds no report", () => {
      buffer.buffer(report(1, 0, "a"));
      changes = [];

      buffer.dropFrame(1, 1);

      expect(changes).toEqual([]);
    });
  });

  describe("forget", () => {
    it("drops that tab's reports, leaves other tabs alone, and emits once", () => {
      buffer.buffer(report(1, 0, "a"));
      buffer.buffer(report(1, 1, "b"));
      buffer.buffer(report(2, 0, "o"));
      changes = [];

      buffer.forget(1);

      expect(buffered()).toEqual(["o"]);
      expect(changes).toEqual([["o"]]);
    });

    it("emits nothing when the tab holds no report", () => {
      buffer.buffer(report(2, 0, "o"));
      changes = [];

      buffer.forget(1);

      expect(changes).toEqual([]);
    });

    it("forgets the order of the tab's reports, and only that tab's", () => {
      buffer.buffer(report(1, 0, "one", Number.MAX_SAFE_INTEGER, 5));
      buffer.buffer(report(10, 0, "ten", Number.MAX_SAFE_INTEGER, 5));

      buffer.forget(1);
      buffer.buffer(report(1, 0, "one-again", Number.MAX_SAFE_INTEGER, 1));
      buffer.buffer(report(10, 0, "ten-older", Number.MAX_SAFE_INTEGER, 1));

      expect(buffered()).toEqual(["ten", "one-again"]);
    });
  });

  describe("clear", () => {
    it("drops every report and emits, even when nothing is buffered", () => {
      buffer.clear();
      expect(changes).toEqual([[]]);

      buffer.buffer(report(1, 0, "a"));
      buffer.buffer(report(2, 0, "b"));
      buffer.clear();

      expect(buffered()).toEqual([]);
      expect(changes.at(-1)).toEqual([]);
    });

    it("does not resolve a report that was buffered before it", () => {
      buffer.buffer(report(1, 0, "before"));

      buffer.clear();
      buffer.resolve(1);

      expect(resolved).toEqual([]);
    });

    it("forgets the order of reports from before it", () => {
      buffer.buffer(report(1, 0, "before", Number.MAX_SAFE_INTEGER, 5));

      buffer.clear();
      buffer.buffer(report(1, 0, "after", Number.MAX_SAFE_INTEGER, 1));

      expect(buffered()).toEqual(["after"]);
    });

    it("leaves the buffer enabled", () => {
      buffer.clear();

      buffer.buffer(report(1, 0, "a"));

      expect(buffered()).toEqual(["a"]);
    });
  });

  describe("setEnabled", () => {
    it("is disabled until enabled, and buffers nothing", () => {
      const fresh = new DefaultTransitionBuffer(() => now);

      fresh.buffer(report(1, 0, "a"));

      expect(fresh.buffered.size).toBe(0);
    });

    it("clears on false", () => {
      buffer.buffer(report(1, 0, "a"));
      buffer.buffer(report(1, 1, "b"));

      buffer.setEnabled(false);

      expect(buffered()).toEqual([]);
      expect(changes.at(-1)).toEqual([]);
    });

    it("while disabled, buffers nothing", () => {
      buffer.setEnabled(false);

      buffer.buffer(report(1, 0, "a"));

      expect(buffered()).toEqual([]);
    });

    it("buffers again once enabled", () => {
      buffer.setEnabled(false);
      buffer.setEnabled(true);

      buffer.buffer(report(1, 0, "a"));

      expect(buffered()).toEqual(["a"]);
    });

    it("emits on false even when nothing is buffered", () => {
      buffer.setEnabled(false);

      expect(changes).toEqual([[]]);
    });

    it("forgets the order of reports from before a disable", () => {
      buffer.buffer(report(1, 0, "before", Number.MAX_SAFE_INTEGER, 5));

      buffer.setEnabled(false);
      buffer.setEnabled(true);
      buffer.buffer(report(1, 0, "after", Number.MAX_SAFE_INTEGER, 1));

      expect(buffered()).toEqual(["after"]);
    });
  });

  it("emits the same map each time, updated in place", () => {
    const maps: ReadonlyMap<string, BufferedTransitionReport>[] = [];
    buffer.buffered$.subscribe((b) => maps.push(b));

    buffer.buffer(report(1, 0, "a"));
    buffer.buffer(report(1, 1, "b"));

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
