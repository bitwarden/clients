import { map, Subject, tap } from "rxjs";
import { TestScheduler } from "rxjs/testing";

import { latestByKey } from "./latest-by-key";

describe("latestByKey", () => {
  let scheduler: TestScheduler;
  beforeEach(() => {
    scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
  });

  it("emits the empty map before any pair, so a join has a value at once", () => {
    scheduler.run(({ cold, expectObservable }) => {
      expectObservable(
        cold<readonly [string, number]>("-").pipe(latestByKey<string, number>()),
      ).toBe("e", {
        e: new Map(),
      });
    });
  });

  it("keeps the latest value for each key", () => {
    scheduler.run(({ cold, expectObservable }) => {
      const pairs = cold("-a-b-c", {
        a: ["x", 1] as const,
        b: ["y", 2] as const,
        c: ["x", 3] as const,
      });

      // snapshot each emission, because the map itself is updated in place
      const snapshots = pairs.pipe(
        latestByKey<string, number>(),
        map((latest) => [...latest]),
      );

      expectObservable(snapshots).toBe("ea-b-c", {
        e: [],
        a: [["x", 1]],
        b: [
          ["x", 1],
          ["y", 2],
        ],
        c: [
          ["x", 3],
          ["y", 2],
        ],
      });
    });
  });

  it("removes an entry when its key is removed", () => {
    scheduler.run(({ cold, expectObservable }) => {
      const pairs = cold("-a-b", { a: ["x", 1] as const, b: ["y", 2] as const });
      const removed = cold("----r-u", { r: "x", u: "unknown" });

      const snapshots = pairs.pipe(
        latestByKey<string, number>(removed),
        map((latest) => [...latest]),
      );

      // removing a key that has no entry is a no-op
      expectObservable(snapshots).toBe("ea-br-u", {
        e: [],
        a: [["x", 1]],
        b: [
          ["x", 1],
          ["y", 2],
        ],
        r: [["y", 2]],
        u: [["y", 2]],
      });
    });
  });

  it("emits one map, updated in place", () => {
    const pairs$ = new Subject<readonly [string, number]>();
    const maps: ReadonlyMap<string, number>[] = [];
    pairs$
      .pipe(
        latestByKey<string, number>(),
        tap((latest) => maps.push(latest)),
      )
      .subscribe();

    pairs$.next(["x", 1]);

    expect(maps).toHaveLength(2);
    expect(maps[1]).toBe(maps[0]);
    expect(maps[0].get("x")).toBe(1);
  });

  it("gives each subscription its own map", () => {
    const pairs$ = new Subject<readonly [string, number]>();
    const latest$ = pairs$.pipe(latestByKey<string, number>());
    const maps: ReadonlyMap<string, number>[] = [];
    latest$.subscribe((m) => maps.push(m));
    latest$.subscribe((m) => maps.push(m));

    pairs$.next(["x", 1]);

    expect(maps[0]).not.toBe(maps[1]);
    expect(maps[0].get("x")).toBe(1);
  });
});
