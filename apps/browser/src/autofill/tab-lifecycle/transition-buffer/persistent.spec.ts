import { mock } from "jest-mock-extended";
import { firstValueFrom, Subject } from "rxjs";

import { FakeStateProvider, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { GlobalState, KeyDefinition } from "@bitwarden/state";

import { TabEdgeCause, TabState } from "../enums";
import type { TabEdge } from "../types";

import {
  BUFFERED_TRANSITIONS,
  PersistentTransitionBuffer,
  resetTransitionBuffer,
} from "./persistent";
import type { BufferedTransitionReport, BufferedTransitions } from "./types";
import { transitionKey } from "./utils";

const userId = "user-1" as UserId;

function report(
  tabId: number,
  frameId: number | undefined,
  documentId: string,
  expiresAt = 10_000,
  stampedAt = 0,
): BufferedTransitionReport {
  return { userId, tabId, frameId, documentId, stampedAt, expiresAt };
}

const hot: TabEdge = {
  from: TabState.WarmUp,
  to: TabState.Hot,
  cause: TabEdgeCause.Settle,
  focused: true,
};

// the load resolves asynchronously, and writes complete asynchronously
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("BUFFERED_TRANSITIONS", () => {
  it("is global, not per user", () => {
    expect(BUFFERED_TRANSITIONS).toBeInstanceOf(KeyDefinition);
  });

  it("round-trips a record", () => {
    const record = {
      [transitionKey(report(1, 0, "a"))]: report(1, 0, "a"),
      [transitionKey(report(1, undefined, "top"))]: report(1, undefined, "top"),
    };

    expect(BUFFERED_TRANSITIONS.deserializer(JSON.parse(JSON.stringify(record)))).toEqual(record);
  });

  it("is an empty record when nothing is stored", () => {
    expect(BUFFERED_TRANSITIONS.deserializer(null as any)).toEqual({});
  });

  const valid = { userId, tabId: 1, frameId: 0, documentId: "d", stampedAt: 0, expiresAt: 5 };
  it.each([
    ["missing userId", { ...valid, userId: undefined }],
    ["empty userId", { ...valid, userId: "" }],
    ["missing documentId", { ...valid, documentId: undefined }],
    ["empty documentId", { ...valid, documentId: "" }],
    ["missing expiresAt", { ...valid, expiresAt: undefined }],
    ["non-numeric expiresAt", { ...valid, expiresAt: "soon" }],
    ["null expiresAt", { ...valid, expiresAt: null }],
    ["missing tabId", { ...valid, tabId: undefined }],
    ["not an object", "d"],
  ])("drops an entry with %s and keeps the rest", (_name, bad) => {
    const good = report(2, 0, "good");

    const result = BUFFERED_TRANSITIONS.deserializer({ bad, good } as any);

    expect(result).toEqual({ good });
  });
});

describe("PersistentTransitionBuffer", () => {
  const now = 1_000;
  let stateProvider: FakeStateProvider;

  beforeEach(() => {
    stateProvider = new FakeStateProvider(mockAccountServiceWith(userId));
  });

  const globalState = () => stateProvider.getGlobal(BUFFERED_TRANSITIONS);
  const stored = async () => Object.values((await firstValueFrom(globalState().state$)) ?? {});
  const seed = (...reports: BufferedTransitionReport[]) =>
    globalState().update(() =>
      Object.fromEntries(reports.map((r) => [transitionKey(r), r] as const)),
    );

  /** A buffer over `state`, enabled or disabled from the start. */
  function start(state: GlobalState<BufferedTransitions> = globalState(), enabled = true) {
    const resolved: BufferedTransitionReport[] = [];
    const errors: unknown[] = [];
    const buffer = new PersistentTransitionBuffer(state, () => now);
    buffer.resolved$.subscribe({
      next: (r) => resolved.push(r),
      error: (e: unknown) => errors.push(e),
    });
    buffer.setEnabled(enabled);
    return { buffer, resolved, errors };
  }

  it("stores what the buffer holds", async () => {
    const { buffer } = start();
    const a = report(1, 0, "a");

    buffer.report(a);
    await settle();

    expect(await stored()).toEqual([a]);
  });

  it("removes a report from storage when it resolves", async () => {
    const { buffer, resolved } = start();
    const a = report(1, 0, "a");
    buffer.report(a);
    await settle();

    buffer.lifecycleChanged(1, hot);
    await settle();

    expect(resolved).toEqual([a]);
    expect(await stored()).toEqual([]);
  });

  it("does not store a report that resolves on arrival", async () => {
    const { buffer, resolved } = start();
    buffer.lifecycleChanged(1, hot);
    const a = report(1, 0, "a");

    buffer.report(a);
    await settle();

    expect(resolved).toEqual([a]);
    expect(await stored()).toEqual([]);
  });

  describe("setEnabled", () => {
    it("disabling empties storage, and the next write restores nothing from before it", async () => {
      const { buffer } = start();
      buffer.report(report(1, 0, "before"));
      await settle();

      buffer.setEnabled(false);
      buffer.setEnabled(true);
      const after = report(2, 0, "after");
      buffer.report(after);
      await settle();

      expect(await stored()).toEqual([after]);
    });

    it("a report made after re-enabling is stored", async () => {
      const { buffer } = start();
      buffer.setEnabled(false);
      buffer.setEnabled(true);
      const after = report(1, 0, "after");

      buffer.report(after);
      await settle();

      expect(await stored()).toEqual([after]);
    });

    it("while disabled, nothing is stored", async () => {
      const { buffer } = start(globalState(), false);

      buffer.report(report(1, 0, "a"));
      await settle();

      expect(await stored()).toEqual([]);
    });
  });

  describe("restore", () => {
    it("a buffer that starts enabled restores the unexpired reports it finds", async () => {
      const live = report(1, 0, "live", 2_000);
      const stale = report(1, 1, "stale", 1_000);
      await seed(live, stale);
      const { buffer, resolved } = start();
      await settle();

      buffer.lifecycleChanged(1, hot);

      expect(resolved).toEqual([live]);
    });

    it("a restore leaves expired reports out of storage", async () => {
      await seed(report(1, 0, "stale", 1_000));
      start();
      await settle();

      expect(await stored()).toEqual([]);
    });

    it("a restore leaves a report that resolves at once out of storage", async () => {
      const live = report(1, 0, "live", 2_000);
      await seed(live);
      const { buffer, resolved } = start();
      buffer.lifecycleChanged(1, hot);
      await settle();

      expect(resolved).toEqual([live]);
      expect(await stored()).toEqual([]);
    });

    it("a buffer that starts disabled restores nothing, and empties storage", async () => {
      await seed(report(1, 0, "stored"));
      const { buffer, resolved } = start(globalState(), false);
      await settle();

      buffer.setEnabled(true);
      buffer.lifecycleChanged(1, hot);
      await settle();

      expect(resolved).toEqual([]);
      expect(await stored()).toEqual([]);
    });
  });

  describe("over a mocked store", () => {
    let loaded$: Subject<BufferedTransitions | null>;
    let state: GlobalState<BufferedTransitions>;

    beforeEach(() => {
      loaded$ = new Subject();
      state = mock<GlobalState<BufferedTransitions>>();
      Object.assign(state, { state$: loaded$ });
      jest.mocked(state.update).mockResolvedValue({});
    });

    /** Each record written, in order. */
    const writes = () =>
      jest.mocked(state.update).mock.calls.map(([configure]) => configure(null, null));

    it("writes nothing until the stored record has been read", async () => {
      const { buffer } = start(state);
      buffer.report(report(1, 0, "fresh"));
      await settle();
      // precondition: the write waits on the read
      expect(state.update).not.toHaveBeenCalled();

      loaded$.next({});
      await settle();

      expect(state.update).toHaveBeenCalled();
    });

    it("a restored report read after a fresh one for its frame does not replace it", async () => {
      const { buffer, resolved } = start(state);
      const fresh = report(1, 0, "fresh", 10_000, 10);
      buffer.report(fresh);

      const older = report(1, 0, "older", 10_000, 1);
      loaded$.next({ [transitionKey(older)]: older });
      await settle();
      buffer.lifecycleChanged(1, hot);

      expect(resolved).toEqual([fresh]);
    });

    it("a restored report read after a fresh one for its frame is not stored over it", async () => {
      const { buffer } = start(state);
      const fresh = report(1, 0, "fresh", 10_000, 10);
      buffer.report(fresh);

      const older = report(1, 0, "older", 10_000, 1);
      loaded$.next({ [transitionKey(older)]: older });
      await settle();

      expect(writes().at(-1)).toEqual({ [transitionKey(fresh)]: fresh });
    });

    it("keeps restored reports for other frames alongside a fresh one", async () => {
      const { buffer } = start(state);
      const fresh = report(1, 0, "fresh", 10_000, 10);
      buffer.report(fresh);

      const other = report(2, 0, "other", 10_000, 1);
      loaded$.next({ [transitionKey(other)]: other });
      await settle();

      // every write, the first included, carries the restored report
      expect(writes()).toEqual([{ [transitionKey(fresh)]: fresh, [transitionKey(other)]: other }]);
    });

    it("a clear while the stored record is being read discards it", async () => {
      const { buffer, resolved } = start(state);
      buffer.setEnabled(false);
      buffer.setEnabled(true);

      const before = report(1, 0, "before");
      loaded$.next({ [transitionKey(before)]: before });
      await settle();
      buffer.lifecycleChanged(1, hot);

      expect(resolved).toEqual([]);
    });

    it("a start disabled then enabled before the read finishes restores nothing", async () => {
      const { buffer, resolved } = start(state, false);
      buffer.setEnabled(true);

      const before = report(1, 0, "before");
      loaded$.next({ [transitionKey(before)]: before });
      await settle();
      buffer.lifecycleChanged(1, hot);

      expect(resolved).toEqual([]);
    });

    it("a clear lands after a write that was already in flight", async () => {
      let finishFirst!: () => void;
      jest
        .mocked(state.update)
        .mockImplementationOnce(() => new Promise((resolve) => (finishFirst = () => resolve({}))));
      const { buffer } = start(state);
      loaded$.next({});
      buffer.report(report(1, 0, "a"));
      await settle();

      buffer.setEnabled(false);
      await settle();
      // precondition: the clear is waiting behind the write in flight
      expect(state.update).toHaveBeenCalledTimes(1);
      finishFirst();
      await settle();

      expect(writes().at(-1)).toEqual({});
    });

    describe("when storage fails", () => {
      it("a write that fails errors resolved$", async () => {
        const failure = new Error("storage unavailable");
        jest.mocked(state.update).mockRejectedValue(failure);
        const { buffer, errors } = start(state);
        loaded$.next({});

        buffer.report(report(1, 0, "a"));
        await settle();

        expect(errors).toEqual([failure]);
      });

      it("writes nothing more after a write fails", async () => {
        jest.mocked(state.update).mockRejectedValue(new Error("storage unavailable"));
        const { buffer } = start(state);
        loaded$.next({});
        buffer.report(report(1, 0, "a"));
        await settle();

        buffer.report(report(2, 0, "b"));
        buffer.setEnabled(false);
        await settle();

        expect(state.update).toHaveBeenCalledTimes(1);
      });

      it("a read that fails errors resolved$ and writes nothing", async () => {
        const failure = new Error("storage unavailable");
        const { buffer, errors } = start(state);
        buffer.report(report(1, 0, "a"));

        loaded$.error(failure);
        await settle();

        expect(errors).toEqual([failure]);
        expect(state.update).not.toHaveBeenCalled();
      });

      it("disposing after a failure leaves the error as it is", async () => {
        const failure = new Error("storage unavailable");
        jest.mocked(state.update).mockRejectedValue(failure);
        const { buffer, errors } = start(state);
        loaded$.next({});
        buffer.report(report(1, 0, "a"));
        await settle();

        buffer[Symbol.dispose]();

        expect(errors).toEqual([failure]);
      });
    });
  });

  describe("[Symbol.dispose]", () => {
    it("completes resolved$", () => {
      const { buffer } = start();
      let completed = false;
      buffer.resolved$.subscribe({ complete: () => (completed = true) });

      buffer[Symbol.dispose]();

      expect(completed).toBe(true);
    });

    it("neither restores nor writes", async () => {
      await seed(report(1, 0, "stored"));
      const { buffer } = start();
      const update = jest.spyOn(globalState(), "update");

      buffer[Symbol.dispose]();
      buffer.report(report(2, 0, "after"));
      await settle();

      expect(update).not.toHaveBeenCalled();
    });
  });
});

describe("resetTransitionBuffer", () => {
  it("empties the stored buffer", async () => {
    const stateProvider = new FakeStateProvider(mockAccountServiceWith(userId));
    const state = stateProvider.getGlobal(BUFFERED_TRANSITIONS);
    const a = report(1, 0, "a");
    await state.update(() => ({ [transitionKey(a)]: a }));

    await resetTransitionBuffer(stateProvider);

    expect(await firstValueFrom(state.state$)).toEqual({});
  });
});
