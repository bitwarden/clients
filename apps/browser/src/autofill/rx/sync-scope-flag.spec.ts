import { Subject, of } from "rxjs";
import { filter, map, mergeMap } from "rxjs/operators";

let syncScopeModule: typeof import("./sync-scope-flag");

describe("assertSynchronousScope / assertSynchronous", () => {
  afterEach(() => {
    delete process.env.BW_DETECT_SYNC_BOUNDARIES;
  });

  describe("when enabled", () => {
    let report: jest.Mock;

    beforeEach(async () => {
      process.env.BW_DETECT_SYNC_BOUNDARIES = "true";

      await jest.isolateModulesAsync(async () => {
        syncScopeModule = await import("./sync-scope-flag");
      });

      report = jest.fn();
    });

    it("does not report a value that stays on the synchronous stack", () => {
      const { enter, exit } = syncScopeModule.assertSynchronousScope("sync", report);
      const source = new Subject<number>();
      const seen: number[] = [];
      source
        .pipe(
          enter,
          map((v: number) => v + 1),
          exit,
        )
        .subscribe((v) => seen.push(v));

      source.next(1);

      expect(seen).toEqual([2]);
      expect(report).not.toHaveBeenCalled();
    });

    it("does not report synchronous fan-out (mergeMap emitting multiple values inline)", () => {
      const { enter, exit } = syncScopeModule.assertSynchronousScope("fan-out", report);
      const source = new Subject<number>();
      const seen: number[] = [];
      source
        .pipe(
          enter,
          mergeMap((v: number) => [v, v + 1]),
          exit,
        )
        .subscribe((v) => seen.push(v));

      source.next(1);

      expect(seen).toEqual([1, 2]);
      expect(report).not.toHaveBeenCalled();
    });

    it("does not report a value dropped before it reaches exit", () => {
      const { enter, exit } = syncScopeModule.assertSynchronousScope("drop", report);
      const source = new Subject<number>();
      const seen: number[] = [];
      source
        .pipe(
          enter,
          filter((v: number) => v % 2 === 0),
          exit,
        )
        .subscribe((v) => seen.push(v));

      source.next(1);

      expect(seen).toEqual([]);
      expect(report).not.toHaveBeenCalled();
    });

    it("does not report a value dropped by a synchronous throw between enter and exit", () => {
      const { enter, exit } = syncScopeModule.assertSynchronousScope("throw", report);
      const source = new Subject<number>();
      const errors: unknown[] = [];
      source
        .pipe(
          enter,
          map((): number => {
            throw new Error("boom");
          }),
          exit,
        )
        .subscribe({ error: (e: unknown) => errors.push(e) });

      source.next(1);

      expect(errors).toEqual([new Error("boom")]);
      expect(report).not.toHaveBeenCalled();
    });

    it("reports when a value crosses an asynchronous boundary between enter and exit", async () => {
      const { enter, exit } = syncScopeModule.assertSynchronousScope("async-boundary", report);
      const source = new Subject<number>();
      const seen: number[] = [];
      source
        .pipe(
          enter,
          mergeMap((v: number) => Promise.resolve(v)),
          exit,
        )
        .subscribe((v) => seen.push(v));

      source.next(1);
      // still synchronous here — the promise hasn't resolved yet
      expect(report).not.toHaveBeenCalled();

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(seen).toEqual([1]);
      expect(report).toHaveBeenCalledTimes(1);
      expect(report.mock.calls[0][0]).toContain("async-boundary");
    });

    it("reports a value whose async continuation resolves after a later, synchronous emission opened and closed its own window", async () => {
      // Regression guard for the call-stack-depth mechanism: a later, wholly
      // synchronous emission on the same scope must not mask an earlier, still
      // in-flight asynchronous one. (A shared "last generation" scalar can be
      // fooled by this kind of interleaving; a call-stack depth cannot.)
      const { enter, exit } = syncScopeModule.assertSynchronousScope("overlap", report);
      const source = new Subject<number>();
      const seen: number[] = [];
      source
        .pipe(
          enter,
          mergeMap((v: number) => (v === 1 ? Promise.resolve(v) : of(v))),
          exit,
        )
        .subscribe((v) => seen.push(v));

      source.next(1); // enters, then waits on a promise — doesn't reach exit yet
      source.next(2); // enters and resolves synchronously — must not mask value 1's gap

      expect(seen).toEqual([2]);
      expect(report).not.toHaveBeenCalled();

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(seen).toEqual([2, 1]);
      expect(report).toHaveBeenCalledTimes(1);
      expect(report.mock.calls[0][0]).toContain("overlap");
    });

    it("propagates an error notification through enter and exit", () => {
      const { enter, exit } = syncScopeModule.assertSynchronousScope("error-path", report);
      const source = new Subject<number>();
      const errors: unknown[] = [];
      source.pipe(enter, exit).subscribe({ error: (e: unknown) => errors.push(e) });

      const boom = new Error("boom");
      source.error(boom);

      expect(errors).toEqual([boom]);
    });

    it("propagates completion through enter and exit", () => {
      const { enter, exit } = syncScopeModule.assertSynchronousScope("complete-path", report);
      const source = new Subject<number>();
      let completed = false;
      source.pipe(enter, exit).subscribe({ complete: () => (completed = true) });

      source.complete();

      expect(completed).toBe(true);
    });

    it("assertSynchronous brackets a single operator equivalently", async () => {
      const source = new Subject<number>();
      const seen: number[] = [];
      source
        .pipe(
          syncScopeModule.assertSynchronous(
            "wrapped",
            mergeMap((v: number) => Promise.resolve(v)),
            report,
          ),
        )
        .subscribe((v) => seen.push(v));

      source.next(1);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(seen).toEqual([1]);
      expect(report).toHaveBeenCalledTimes(1);
      expect(report.mock.calls[0][0]).toContain("wrapped");
    });
  });

  describe("when disabled", () => {
    let report: jest.Mock;

    beforeEach(async () => {
      delete process.env.BW_DETECT_SYNC_BOUNDARIES;

      await jest.isolateModulesAsync(async () => {
        syncScopeModule = await import("./sync-scope-flag");
      });

      report = jest.fn();
    });

    it("enter/exit are the identity operator — no wrapping observable is created", () => {
      const { enter, exit } = syncScopeModule.assertSynchronousScope("noop", report);
      const source = new Subject<number>();

      expect(enter(source)).toBe(source);
      expect(exit(source)).toBe(source);
    });

    it("is a strict no-op even across a genuine asynchronous boundary", async () => {
      const { enter, exit } = syncScopeModule.assertSynchronousScope("noop-async", report);
      const source = new Subject<number>();
      const seen: number[] = [];
      source
        .pipe(
          enter,
          mergeMap((v: number) => Promise.resolve(v)),
          exit,
        )
        .subscribe((v) => seen.push(v));

      source.next(1);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(seen).toEqual([1]);
      expect(report).not.toHaveBeenCalled();
    });

    it("assertSynchronous returns the wrapped operator untouched", () => {
      const op = map((v: number) => v + 1);
      expect(syncScopeModule.assertSynchronous("noop-wrapped", op, report)).toBe(op);
    });
  });
});
