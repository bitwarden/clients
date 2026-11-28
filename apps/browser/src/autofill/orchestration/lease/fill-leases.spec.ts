import { cancellationToken, NEVER_CANCEL, type CancellationToken } from "../../utils/cancellation";
import { TargetSource } from "../enums";
import type { FillResult } from "../types";
import { AUTOFILL_ABSENT, AUTOFILL_CANCELLED } from "../utils";

import { FillLeases } from "./fill-leases";
import { frameScope, tabScope, type LeaseScope } from "./lease-scope";

const TAB = 1;
const OTHER_TAB = 2;
const FILLED = { outcome: "filled" } as unknown as FillResult;
const NONE = "none";
const DETAILS = "details";

/** Lets every pending promise callback run. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** What `promise` resolved to once pending callbacks have run, or `"pending"` if it has not. */
function settled<T>(promise: Promise<T>): Promise<T | "pending"> {
  return Promise.race([promise, flush().then(() => "pending" as const)]);
}

/**
 * Work the test completes. `started` says whether the lease ran it, and `token` is the token the
 * lease handed it.
 */
function controlled<T>() {
  let finish!: (value: T) => void;
  let fail!: (error: unknown) => void;
  const done = new Promise<T>((resolve, reject) => {
    finish = resolve;
    fail = reject;
  });
  const state = { started: false, token: undefined as CancellationToken | undefined };
  const work = (token: CancellationToken) => {
    state.started = true;
    state.token = token;
    return done;
  };
  return {
    work,
    finish,
    fail,
    get started() {
      return state.started;
    },
    get token(): CancellationToken {
      return state.token!;
    },
  };
}

function arrangeFill(
  leases: FillLeases,
  scope: LeaseScope,
  source: TargetSource,
  cancellation: CancellationToken = NEVER_CANCEL,
) {
  const fill = controlled<FillResult>();
  const result = leases.fill({ scope, source, cancellation }, fill.work);
  return Object.assign(fill, { result });
}

function arrangeCollect(
  leases: FillLeases,
  scope: LeaseScope,
  cancellation: CancellationToken = NEVER_CANCEL,
) {
  const collect = controlled<string>();
  const result = leases.collect({ scope, cancellation }, collect.work, NONE);
  return Object.assign(collect, { result });
}

describe("FillLeases", () => {
  let leases: FillLeases;

  beforeEach(() => {
    leases = new FillLeases();
  });

  describe("a fill", () => {
    it("runs at once when nothing conflicts, and resolves to its work's result", async () => {
      const fill = arrangeFill(leases, tabScope(TAB), TargetSource.User);
      await flush();
      expect(fill.started).toBe(true);

      fill.finish(FILLED);

      expect(await fill.result).toBe(FILLED);
    });

    it("completes as cancelled at once, and preempts nothing, when it arrives cancelled", async () => {
      const eager = arrangeFill(leases, frameScope(TAB, 0), TargetSource.Reported);
      const { cancel, token } = cancellationToken();
      cancel();

      const user = arrangeFill(leases, tabScope(TAB), TargetSource.User, token);

      expect(await settled(user.result)).toBe(AUTOFILL_CANCELLED);
      expect(user.started).toBe(false);
      expect(eager.token.cancelled).toBe(false);
    });

    // A higher-ranked arrival would preempt anything it conflicted with.
    it.each<[string, LeaseScope, LeaseScope]>([
      ["two frames of one tab", frameScope(TAB, 0), frameScope(TAB, 3)],
      ["two tabs", tabScope(TAB), tabScope(OTHER_TAB)],
    ])("does not conflict with a fill of another scope: %s", async (_, first, second) => {
      const eager = arrangeFill(leases, first, TargetSource.Reported);
      const policy = arrangeFill(leases, second, TargetSource.Policy);
      await flush();

      expect(eager.started).toBe(true);
      expect(policy.started).toBe(true);
      expect(eager.token.cancelled).toBe(false);
    });

    it.each<[TargetSource, TargetSource, LeaseScope, LeaseScope]>([
      [TargetSource.Policy, TargetSource.Policy, frameScope(TAB, 0), tabScope(TAB)],
      [TargetSource.User, TargetSource.User, tabScope(TAB), tabScope(TAB)],
      [TargetSource.Reported, TargetSource.Reported, frameScope(TAB, 3), frameScope(TAB, 3)],
      [TargetSource.User, TargetSource.Policy, tabScope(TAB), frameScope(TAB, 0)],
      [TargetSource.Reported, TargetSource.Policy, tabScope(TAB), frameScope(TAB, 0)],
      [TargetSource.Reported, TargetSource.User, tabScope(TAB), frameScope(TAB, 0)],
    ])(
      "that is %s completes as cancelled before it starts while a %s fill is in its way",
      async (arriving, held, heldScope, arrivingScope) => {
        const holder = arrangeFill(leases, heldScope, held);
        await flush();

        const arrived = arrangeFill(leases, arrivingScope, arriving);

        expect(await settled(arrived.result)).toBe(AUTOFILL_CANCELLED);
        expect(arrived.started).toBe(false);
        expect(holder.token.cancelled).toBe(false);
      },
    );

    // The holder's commit has begun, so it completes with its own result.
    it.each<[TargetSource, TargetSource]>([
      [TargetSource.Policy, TargetSource.User],
      [TargetSource.Policy, TargetSource.Reported],
      [TargetSource.User, TargetSource.Reported],
    ])(
      "that is %s preempts a %s fill, and runs once that fill completes with its own result",
      async (arriving, held) => {
        const holder = arrangeFill(leases, frameScope(TAB, 0), held);
        await flush();

        const arrived = arrangeFill(leases, tabScope(TAB), arriving);
        await flush();

        expect(holder.token.cancelled).toBe(true);
        expect(arrived.started).toBe(false);

        holder.finish(FILLED);
        expect(await holder.result).toBe(FILLED);
        await flush();

        expect(arrived.started).toBe(true);
        expect(arrived.token.cancelled).toBe(false);
      },
    );

    it("preempts every lower fill in its way, and waits for each to complete", async () => {
      const first = arrangeFill(leases, frameScope(TAB, 0), TargetSource.Reported);
      const second = arrangeFill(leases, frameScope(TAB, 3), TargetSource.Reported);
      await flush();

      const user = arrangeFill(leases, tabScope(TAB), TargetSource.User);
      expect(first.token.cancelled).toBe(true);
      expect(second.token.cancelled).toBe(true);

      second.finish(AUTOFILL_CANCELLED);
      await flush();
      expect(user.started).toBe(false);

      first.finish(AUTOFILL_CANCELLED);
      await flush();
      expect(user.started).toBe(true);
    });

    it("preempts a lower fill that is waiting, which completes at once", async () => {
      arrangeCollect(leases, frameScope(TAB, 3));
      const waiting = arrangeFill(leases, frameScope(TAB, 3), TargetSource.Reported);
      await flush();
      expect(waiting.started).toBe(false);

      arrangeFill(leases, tabScope(TAB), TargetSource.User);

      expect(await settled(waiting.result)).toBe(AUTOFILL_CANCELLED);
      expect(waiting.started).toBe(false);
    });

    it("preempts nothing when a fill in its way does not rank below it", async () => {
      const eager = arrangeFill(leases, frameScope(TAB, 3), TargetSource.Reported);
      const user = arrangeFill(leases, frameScope(TAB, 0), TargetSource.User);
      await flush();

      const command = arrangeFill(leases, tabScope(TAB), TargetSource.User);

      expect(await settled(command.result)).toBe(AUTOFILL_CANCELLED);
      expect(eager.token.cancelled).toBe(false);
      expect(user.token.cancelled).toBe(false);
    });

    it.each<[TargetSource, TargetSource]>([
      [TargetSource.Reported, TargetSource.Reported],
      [TargetSource.User, TargetSource.User],
      [TargetSource.Reported, TargetSource.User],
      [TargetSource.Reported, TargetSource.Policy],
    ])("that is %s waits for a %s fill in its way that is ending", async (arriving, held) => {
      const ending = cancellationToken();
      const holder = arrangeFill(leases, frameScope(TAB, 0), held, ending.token);
      await flush();
      ending.cancel();

      const arrived = arrangeFill(leases, frameScope(TAB, 0), arriving);
      await flush();
      expect(arrived.started).toBe(false);

      holder.finish(AUTOFILL_CANCELLED);
      await flush();

      expect(arrived.started).toBe(true);
    });

    describe("while a preempted fill is still ending", () => {
      let ending: ReturnType<typeof arrangeFill>;
      let user: ReturnType<typeof arrangeFill>;

      beforeEach(async () => {
        ending = arrangeFill(leases, frameScope(TAB, 0), TargetSource.Reported);
        await flush();
        user = arrangeFill(leases, tabScope(TAB), TargetSource.User);
        await flush();
      });

      it("a higher fill preempts the waiting fill, and waits for the ending one", async () => {
        const policy = arrangeFill(leases, tabScope(TAB), TargetSource.Policy);

        expect(await settled(user.result)).toBe(AUTOFILL_CANCELLED);
        expect(user.started).toBe(false);
        expect(policy.started).toBe(false);

        ending.finish(AUTOFILL_CANCELLED);
        await flush();

        expect(policy.started).toBe(true);
      });

      it.each([TargetSource.User, TargetSource.Reported])(
        "a %s fill completes as cancelled, and leaves both alone",
        async (source) => {
          const arrived = arrangeFill(leases, tabScope(TAB), source);

          expect(await settled(arrived.result)).toBe(AUTOFILL_CANCELLED);
          expect(user.token).toBeUndefined();
          expect(await settled(user.result)).toBe("pending");

          ending.finish(AUTOFILL_CANCELLED);
          await flush();
          expect(user.started).toBe(true);
          expect(user.token.cancelled).toBe(false);
        },
      );
    });

    it("hands its work a token its caller cancels", async () => {
      const caller = cancellationToken();
      const fill = arrangeFill(leases, tabScope(TAB), TargetSource.User, caller.token);
      await flush();

      caller.cancel();

      expect(fill.token.cancelled).toBe(true);
    });

    it("waits for the collects in its scope that arrived before it", async () => {
      const collect = arrangeCollect(leases, frameScope(TAB, 0));
      const fill = arrangeFill(leases, tabScope(TAB), TargetSource.User);
      await flush();
      expect(fill.started).toBe(false);

      collect.finish(DETAILS);
      await flush();

      expect(fill.started).toBe(true);
    });

    it("completes at once when cancelled while it waits, and delays nothing after it", async () => {
      arrangeCollect(leases, tabScope(TAB));
      const caller = cancellationToken();
      const fill = arrangeFill(leases, tabScope(TAB), TargetSource.User, caller.token);
      const later = arrangeCollect(leases, tabScope(TAB));
      await flush();
      expect(later.started).toBe(false);

      caller.cancel();

      expect(await settled(fill.result)).toBe(AUTOFILL_CANCELLED);
      expect(fill.started).toBe(false);
      await flush();
      expect(later.started).toBe(true);
    });

    it("releases its lease when it completes, so a later fill of its rank runs", async () => {
      const first = arrangeFill(leases, tabScope(TAB), TargetSource.User);
      await flush();
      first.finish(AUTOFILL_ABSENT);
      await first.result;

      const second = arrangeFill(leases, tabScope(TAB), TargetSource.User);
      await flush();

      expect(second.started).toBe(true);
    });

    it("rejects when its work rejects, and lets a collect waiting for it run", async () => {
      const fill = arrangeFill(leases, tabScope(TAB), TargetSource.User);
      const collect = arrangeCollect(leases, tabScope(TAB));
      await flush();
      expect(collect.started).toBe(false);
      const error = new Error("phase threw");

      fill.fail(error);

      await expect(fill.result).rejects.toBe(error);
      await flush();
      expect(collect.started).toBe(true);
    });
  });

  describe("a collect", () => {
    it("runs at once when no fill is in its scope, beside other collects", async () => {
      const first = arrangeCollect(leases, tabScope(TAB));
      const second = arrangeCollect(leases, frameScope(TAB, 0));
      await flush();

      expect(first.started).toBe(true);
      expect(second.started).toBe(true);

      second.finish(DETAILS);

      expect(await second.result).toBe(DETAILS);
    });

    it("waits for the fill in its scope that arrived before it", async () => {
      const fill = arrangeFill(leases, frameScope(TAB, 0), TargetSource.Reported);
      const collect = arrangeCollect(leases, tabScope(TAB));
      const elsewhere = arrangeCollect(leases, frameScope(TAB, 3));
      const otherTab = arrangeCollect(leases, tabScope(OTHER_TAB));
      await flush();
      expect(collect.started).toBe(false);
      expect(elsewhere.started).toBe(true);
      expect(otherTab.started).toBe(true);

      fill.finish(FILLED);
      await flush();

      expect(collect.started).toBe(true);
    });

    it("waits behind a fill that is waiting for earlier collects", async () => {
      const earlier = arrangeCollect(leases, tabScope(TAB));
      const fill = arrangeFill(leases, tabScope(TAB), TargetSource.User);
      const later = arrangeCollect(leases, tabScope(TAB));
      await flush();
      expect(later.started).toBe(false);

      earlier.finish(DETAILS);
      await flush();
      expect(fill.started).toBe(true);
      expect(later.started).toBe(false);

      fill.finish(FILLED);
      await flush();

      expect(later.started).toBe(true);
    });

    it("is not preempted, and a fill that arrives after it waits for its details", async () => {
      const collect = arrangeCollect(leases, tabScope(TAB));
      await flush();

      const policy = arrangeFill(leases, tabScope(TAB), TargetSource.Policy);
      await flush();
      expect(policy.started).toBe(false);

      collect.finish(DETAILS);

      expect(await collect.result).toBe(DETAILS);
      await flush();
      expect(policy.started).toBe(true);
    });

    it("rejects when its work rejects, and lets a fill waiting for it run", async () => {
      const collect = arrangeCollect(leases, tabScope(TAB));
      const fill = arrangeFill(leases, tabScope(TAB), TargetSource.User);
      await flush();
      const error = new Error("collect threw");

      collect.fail(error);

      await expect(collect.result).rejects.toBe(error);
      await flush();
      expect(fill.started).toBe(true);
    });

    it("resolves to none when it arrives cancelled", async () => {
      const { cancel, token } = cancellationToken();
      cancel();

      const collect = arrangeCollect(leases, tabScope(TAB), token);

      expect(await settled(collect.result)).toBe(NONE);
      expect(collect.started).toBe(false);
    });

    it("resolves to none when cancelled while it waits, and delays nothing after it", async () => {
      const { cancel, token } = cancellationToken();
      const fill = arrangeFill(leases, tabScope(TAB), TargetSource.Reported);
      const waiting = arrangeCollect(leases, tabScope(TAB), token);
      await flush();

      cancel();

      expect(await settled(waiting.result)).toBe(NONE);
      expect(waiting.started).toBe(false);
      // A fill that arrives now waits only for the fill that holds the tab.
      fill.finish(FILLED);
      const user = arrangeFill(leases, tabScope(TAB), TargetSource.User);
      await flush();
      expect(user.started).toBe(true);
    });
  });
});
