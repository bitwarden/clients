import { BehaviorSubject, NEVER, of } from "rxjs";
import { TestScheduler } from "rxjs/testing";

import { waitFor } from "./timings";

describe("waitFor", () => {
  let scheduler: TestScheduler;
  beforeEach(() => {
    scheduler = new TestScheduler((actual, expected) => expect(actual).toEqual(expected));
  });

  it("emits each value once the length has elapsed", () => {
    scheduler.run(({ cold, expectObservable }) => {
      const source = cold("a 4ms b|", { a: "a", b: "b" });
      expectObservable(source.pipe(waitFor(of(10)))).toBe("10ms a 4ms (b|)", {
        a: "a",
        b: "b",
      });
    });
  });

  it("waits the length current when the value arrives", () => {
    scheduler.run(({ cold, expectObservable }) => {
      const ms$ = new BehaviorSubject(10);
      const source = cold("a 19ms b", { a: "a", b: "b" });
      scheduler.schedule(() => ms$.next(30), 5);
      expectObservable(source.pipe(waitFor(ms$))).toBe("10ms a 39ms b", { a: "a", b: "b" });
    });
  });

  it("waits until a moment", () => {
    scheduler.run(({ cold, expectObservable }) => {
      const source = cold("a", { a: "a" });
      expectObservable(source.pipe(waitFor(of(new Date(10))))).toBe("10ms a", { a: "a" });
    });
  });

  it("releases a value at once when its moment has passed", () => {
    scheduler.run(({ cold, expectObservable }) => {
      const source = cold("5ms a", { a: "a" });
      expectObservable(source.pipe(waitFor(of(new Date(2))))).toBe("5ms a", { a: "a" });
    });
  });

  it("holds a value until the length arrives", () => {
    scheduler.run(({ cold, expectObservable }) => {
      const ms$ = cold("5ms a", { a: 10 });
      const source = cold("a", { a: "a" });
      expectObservable(source.pipe(waitFor(ms$))).toBe("15ms a", { a: "a" });
    });
  });

  it("does not emit while the length is unavailable", () => {
    scheduler.run(({ cold, expectObservable }) => {
      expectObservable(cold("a", { a: "a" }).pipe(waitFor(NEVER))).toBe("-");
    });
  });
});
