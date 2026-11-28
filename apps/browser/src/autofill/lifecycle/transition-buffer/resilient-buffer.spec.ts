import { mock } from "jest-mock-extended";
import { Subject } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";
import { GlobalState, StateProvider } from "@bitwarden/state";

import type { BufferedTransitions } from "./persistent-buffer";
import { ResilientTransitionBuffer } from "./resilient-buffer";
import type { BufferedTransitionReport } from "./types";

/** The URL of the tab whose document reported; distinct for each document. */
const urlOf = (documentId: string) => `https://${documentId}.example/`;

const userId = "user-1" as UserId;
const now = 1000;

function report(tabId: number, frameId: number | undefined, documentId: string) {
  return {
    userId,
    tabId,
    frameId,
    documentId,
    url: urlOf(documentId),
    stampedAt: 0,
    expiresAt: Number.MAX_SAFE_INTEGER,
  } satisfies BufferedTransitionReport;
}

// the load resolves asynchronously, and writes complete asynchronously
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("ResilientTransitionBuffer", () => {
  let loaded$: Subject<BufferedTransitions | null>;
  let state: GlobalState<BufferedTransitions>;
  let stateProvider: StateProvider;
  let failures: unknown[];
  let buffer: ResilientTransitionBuffer;
  let resolved: BufferedTransitionReport[];

  beforeEach(() => {
    loaded$ = new Subject();
    state = mock<GlobalState<BufferedTransitions>>();
    Object.assign(state, { state$: loaded$ });
    jest.mocked(state.update).mockResolvedValue({});
    stateProvider = mock<StateProvider>();
    jest.mocked(stateProvider.getGlobal).mockReturnValue(state as any);
    failures = [];
    resolved = [];
    buffer = new ResilientTransitionBuffer(
      stateProvider,
      () => now,
      (e) => failures.push(e),
    );
    buffer.resolved$.subscribe((r) => resolved.push(r));
    loaded$.next({});
  });

  afterEach(() => buffer[Symbol.dispose]());

  it("resolves what it buffered, while storage works", async () => {
    buffer.setEnabled(true);
    const a = report(1, 0, "a");

    buffer.buffer(a);
    buffer.resolve(1);
    await settle();

    expect(resolved).toEqual([a]);
    expect(failures).toEqual([]);
  });

  describe("when storage fails", () => {
    const failOnWrite = async (enabled: boolean | undefined = true) => {
      const failure = new Error("storage unavailable");
      jest.mocked(state.update).mockRejectedValueOnce(failure).mockResolvedValue({});
      if (enabled !== undefined) {
        buffer.setEnabled(enabled);
      }
      buffer.buffer(report(1, 0, "lost"));
      await settle();
      return failure;
    };

    it("reports the failure and discards the stored record", async () => {
      const failure = await failOnWrite();

      expect(failures).toEqual([failure]);
      const reset = jest.mocked(state.update).mock.calls.at(-1)![0];
      expect(reset({}, undefined as never)).toEqual({});
    });

    it("loses what was waiting at the moment of failure", async () => {
      await failOnWrite();

      buffer.resolve(1);

      expect(resolved).toEqual([]);
    });

    it("continues in memory with the admission it had", async () => {
      await failOnWrite(true);
      const after = report(2, 0, "after");

      buffer.buffer(after);
      buffer.resolve(2);

      expect(resolved).toEqual([after]);
    });

    it("continues disabled when it had been disabled", async () => {
      await failOnWrite(false);

      buffer.buffer(report(2, 0, "after"));
      buffer.resolve(2);

      expect(resolved).toEqual([]);
    });

    it("continues disabled when it fails before it was told whether to admit", async () => {
      const unreadable$ = new Subject<BufferedTransitions | null>();
      Object.assign(state, { state$: unreadable$ });
      const fresh = new ResilientTransitionBuffer(
        stateProvider,
        () => now,
        (e) => failures.push(e),
      );
      const freshResolved: BufferedTransitionReport[] = [];
      fresh.resolved$.subscribe((r) => freshResolved.push(r));
      const failure = new Error("read failed");

      unreadable$.error(failure);
      await settle();
      fresh.buffer(report(1, 0, "a"));
      fresh.resolve(1);

      expect(failures).toEqual([failure]);
      expect(freshResolved).toEqual([]);
      fresh[Symbol.dispose]();
    });

    it("reports a failure to discard the stored record as well", async () => {
      const failure = new Error("storage unavailable");
      jest.mocked(state.update).mockRejectedValue(failure);
      buffer.setEnabled(true);

      buffer.buffer(report(1, 0, "lost"));
      await settle();

      expect(failures).toEqual([failure, failure]);
    });

    it("does not end resolved$", async () => {
      let completed = false;
      let errored = false;
      buffer.resolved$.subscribe({
        complete: () => (completed = true),
        error: () => (errored = true),
      });

      await failOnWrite();

      expect(completed).toBe(false);
      expect(errored).toBe(false);
    });
  });

  it("hands on what the stored buffer restored", async () => {
    const stored = report(1, 0, "stored");
    const unreadable$ = new Subject<BufferedTransitions | null>();
    Object.assign(state, { state$: unreadable$ });
    const fresh = new ResilientTransitionBuffer(
      stateProvider,
      () => now,
      (e) => failures.push(e),
    );
    const restored: BufferedTransitionReport[] = [];
    fresh.restored$.subscribe((r) => restored.push(r));

    fresh.setEnabled(true);
    unreadable$.next({ "1:0": stored });
    await settle();

    expect(restored).toEqual([stored]);
    fresh[Symbol.dispose]();
  });

  it("completes resolved$ when disposed", () => {
    let completed = false;
    buffer.resolved$.subscribe({ complete: () => (completed = true) });

    buffer[Symbol.dispose]();

    expect(completed).toBe(true);
  });
});
