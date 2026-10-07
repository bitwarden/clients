import { Observable } from "rxjs";

import {
  OPENSHELL_CARRY_WINDOW_MS,
  OPENSHELL_DELIVERED_DEDUPE_MS,
  OPENSHELL_DIALOG_LINGER_MS,
  OPENSHELL_DIALOG_MAX_MS,
} from "../models/openshell";

import {
  OpenShellDialogResult,
  OpenShellResolveCoalescer,
  OpenShellWaitResult,
} from "./openshell-resolve-coalescer";

describe("OpenShellResolveCoalescer (§M8.18)", () => {
  let now: number;
  let coalescer: OpenShellResolveCoalescer;
  let answer: (result: OpenShellDialogResult) => void;
  let close: jest.Mock;
  let initialRemaining: number | undefined;
  let updates: number[];

  const lifetime = () => ({ mode: "ttl" as const, expiresAtMs: now + 3_600_000 });

  function opener(initialRemainingMs: number, deadlineUpdates: Observable<number>) {
    initialRemaining = initialRemainingMs;
    deadlineUpdates.subscribe((ms) => updates.push(ms));
    return {
      closed: new Promise<OpenShellDialogResult>((resolve) => (answer = resolve)),
      close,
    };
  }

  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ["Date"] });
    now = 1_000_000;
    coalescer = new OpenShellResolveCoalescer(() => now);
    close = jest.fn();
    updates = [];
    initialRemaining = undefined;
  });

  afterEach(() => jest.useRealTimers());

  it("starts the countdown at the decision deadline plus the linger, capped at the maximum", () => {
    coalescer.open("k", now + 20_000, opener, lifetime);
    expect(initialRemaining).toBe(20_000 + OPENSHELL_DIALOG_LINGER_MS);

    void coalescer.wait("k", now + 50_000);
    // Capped at OPENSHELL_DIALOG_MAX_MS after opening.
    expect(updates).toEqual([OPENSHELL_DIALOG_MAX_MS]);
    void coalescer.wait("k", now + 55_000);
    expect(updates).toEqual([OPENSHELL_DIALOG_MAX_MS]);
  });

  it("answers every waiter with one approval and carries it", async () => {
    const { result, closed } = coalescer.open("k", now + 20_000, opener, lifetime);
    const second = coalescer.wait("k", now + 20_000);
    answer("approved");
    await closed;
    const [a, b] = (await Promise.all([result, second])) as Array<
      Extract<OpenShellWaitResult, { kind: "decided" }>
    >;
    expect(a.carried).toBe(b.carried);
    expect(a.carried.decision).toEqual({ kind: "approved", lifetime: lifetime() });
    expect(coalescer.decisionFor("k")?.expiresAtMs).toBe(now + OPENSHELL_CARRY_WINDOW_MS);
    expect(coalescer.hasDialog("k")).toBe(false);
  });

  it("times a waiter out at its own deadline without closing the dialog", async () => {
    const { result } = coalescer.open("k", now + 5_000, opener, lifetime);
    await jest.advanceTimersByTimeAsync(5_000);
    expect(await result).toEqual({ kind: "timeout" });
    expect(coalescer.hasDialog("k")).toBe(true);
    expect(close).not.toHaveBeenCalled();
  });

  it("marks a carried approval delivered exactly once, then keeps it only for the dedupe window", async () => {
    const { result, closed } = coalescer.open("k", now + 20_000, opener, lifetime);
    answer("approved");
    await closed;
    const decided = (await result) as Extract<OpenShellWaitResult, { kind: "decided" }>;
    now += 5_000;
    expect(coalescer.markDelivered(decided.carried)).toBe(true);
    expect(coalescer.markDelivered(decided.carried)).toBe(false);
    now += OPENSHELL_DELIVERED_DEDUPE_MS - 1;
    expect(coalescer.decisionFor("k")).toBeDefined();
    now += 1;
    expect(coalescer.decisionFor("k")).toBeUndefined();
  });

  it("never marks a denial delivered", async () => {
    const { result, closed } = coalescer.open("k", now + 20_000, opener, lifetime);
    answer("denied");
    await closed;
    const decided = (await result) as Extract<OpenShellWaitResult, { kind: "decided" }>;
    expect(decided.carried.decision).toEqual({ kind: "denied" });
    expect(coalescer.markDelivered(decided.carried)).toBe(false);
  });

  it("carries nothing from an unanswered dialog", async () => {
    const { result, closed } = coalescer.open("k", now + 20_000, opener, lifetime);
    answer("timeout");
    await closed;
    expect(await result).toEqual({ kind: "timeout" });
    expect(coalescer.isKnown("k")).toBe(false);
  });

  it("treats a dialog closed without a button as a denial", async () => {
    const { result, closed } = coalescer.open("k", now + 20_000, opener, lifetime);
    answer(undefined);
    await closed;
    expect(await result).toMatchObject({
      kind: "decided",
      carried: { decision: { kind: "denied" } },
    });
  });

  it("decides nothing when the dialog can't be opened", async () => {
    expect(() =>
      coalescer.open(
        "k",
        now + 20_000,
        () => {
          throw new Error("no dialog");
        },
        lifetime,
      ),
    ).toThrow("no dialog");
    expect(coalescer.isKnown("k")).toBe(false);
  });

  it("keeps keys apart", async () => {
    const { closed } = coalescer.open("k1", now + 20_000, opener, lifetime);
    answer("approved");
    await closed;
    expect(coalescer.isKnown("k1")).toBe(true);
    expect(coalescer.isKnown("k2")).toBe(false);
    expect(await coalescer.wait("k2", now + 20_000)).toEqual({ kind: "timeout" });
  });

  it("clear() drops decisions, closes dialogs and ignores their later answers", async () => {
    const first = coalescer.open("a", now + 20_000, opener, lifetime);
    answer("denied");
    await first.closed;
    const second = coalescer.open("b", now + 20_000, opener, lifetime);
    coalescer.clear();
    expect(close).toHaveBeenCalledTimes(1);
    expect(await second.result).toEqual({ kind: "timeout" });
    answer("approved");
    await second.closed;
    expect(coalescer.isKnown("a")).toBe(false);
    expect(coalescer.isKnown("b")).toBe(false);
  });
});
