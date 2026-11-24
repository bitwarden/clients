import { mock } from "jest-mock-extended";
import { EMPTY, Subject, throwError } from "rxjs";

import { AutofillOutcome } from "../../enums/autofill-outcome.enum";
import { cancellationToken, NEVER_CANCEL } from "../../utils/cancellation";
import type { FillResult } from "../types";
import { AUTOFILL_ABSENT, AUTOFILL_CANCELLED, AUTOFILL_DENIED, AUTOFILL_INVALID } from "../utils";

import type { FillRequest } from "./context";
import type {
  FillCommit,
  FillEffect,
  FillFilled,
  FillPhase,
  FillPhases,
  WorkflowEngineOptions,
} from "./types";
import { workflowEngine } from "./workflow-engine";

// The runner reads nothing of the context, so these stand in for the request and what phases add.
type Request = { requested: true };
type Target = { targeted: true };
type Page = { read: true };
type Selection = { selected: true };
type Context = Request & Target & Page & Selection;

const FILLED: FillFilled = Object.freeze({ outcome: AutofillOutcome.Filled, totp: "123456" });
const request = { requested: true } as unknown as FillRequest;
const fullContext: Context = { requested: true, targeted: true, read: true, selected: true };

const phaseNames = ["target", "read", "select", "reprompt"] as const;
type PhaseName = (typeof phaseNames)[number];
type StepName = PhaseName | "commit";

/** The context each phase reads. */
const contextOf: Record<StepName, object> = {
  target: request,
  read: { requested: true, targeted: true },
  select: { requested: true, targeted: true, read: true },
  reprompt: fullContext,
  commit: fullContext,
};

/** What each phase adds. */
const additionOf: Record<PhaseName, object> = {
  target: { targeted: true },
  read: { read: true },
  select: { selected: true },
  reprompt: {},
};

/** The ten steps of one attempt, in order. */
const ATTEMPT = [
  "target.check",
  "target.execute",
  "read.check",
  "read.execute",
  "select.check",
  "select.execute",
  "reprompt.check",
  "reprompt.execute",
  "commit.check",
  "commit.execute",
];

type Step = { check: jest.Mock; execute: jest.Mock };

function harness(commitResults: FillResult[] = [FILLED]) {
  const calls: string[] = [];

  const fakePhase = (name: PhaseName): Step => {
    const phase = mock<Step>();
    phase.check.mockImplementation(async () => {
      calls.push(`${name}.check`);
      return undefined;
    });
    phase.execute.mockImplementation(async () => {
      calls.push(`${name}.execute`);
      return additionOf[name];
    });
    return phase;
  };

  // A commit that resolves to each of `commitResults` in turn, and to the last one after that.
  const remaining = [...commitResults];
  const commit = mock<FillCommit<Context>>();
  commit.check.mockImplementation(async () => {
    calls.push("commit.check");
    return undefined;
  });
  commit.execute.mockImplementation(async () => {
    calls.push("commit.execute");
    return remaining.length > 1 ? remaining.shift()! : remaining[0];
  });

  const steps: Record<StepName, Step> = {
    target: fakePhase("target"),
    read: fakePhase("read"),
    select: fakePhase("select"),
    reprompt: fakePhase("reprompt"),
    commit,
  };
  const effects: FillEffect<Context>[] = [];
  const effectFailed = jest.fn();
  // The fakes are untyped so that a test can make any of them end the fill. The "types" tests pin
  // what a typed phase may be.
  const phases = { ...steps, effects } as unknown as FillPhases;
  const run = (options: Partial<WorkflowEngineOptions> = {}) =>
    workflowEngine(phases, { effectFailed, ...options });
  return { calls, steps, commit, effects, effectFailed, run };
}

describe("workflowEngine", () => {
  describe("order", () => {
    it("checks and executes each phase in order, and commits last", async () => {
      const { calls, run } = harness();

      const result = await run()(request, NEVER_CANCEL);

      expect(result).toBe(FILLED);
      expect(calls).toEqual(ATTEMPT);
    });

    it.each(phaseNames)(
      "gives the %s check and execute the request and what every earlier phase added",
      async (name) => {
        const { steps, run } = harness();

        await run()(request, NEVER_CANCEL);

        expect(steps[name].check).toHaveBeenCalledWith(contextOf[name], NEVER_CANCEL);
        expect(steps[name].execute).toHaveBeenCalledWith(contextOf[name], NEVER_CANCEL);
      },
    );

    it("gives the commit's check the whole context and its execute no token", async () => {
      const { commit, run } = harness();

      await run()(request, NEVER_CANCEL);

      expect(commit.check).toHaveBeenCalledWith(fullContext, NEVER_CANCEL);
      expect(commit.execute).toHaveBeenCalledWith(fullContext);
    });

    it("keeps what the request and earlier phases hold when a phase returns the same key", async () => {
      const { steps, run } = harness();
      steps.read.execute.mockResolvedValueOnce({ read: true, targeted: "replaced" });

      await run()(request, NEVER_CANCEL);

      expect(steps.select.check).toHaveBeenCalledWith(contextOf.select, NEVER_CANCEL);
    });
  });

  describe("types", () => {
    // These pin compile-time rules. `@ts-expect-error` fails the type check when the line below it
    // stops being an error.
    it("rejects a phase that would replace a key of its context", () => {
      // @ts-expect-error -- the read may not replace what the target added
      const replacing = mock<FillPhase<Request & Target, { targeted: false }>>();
      expect(replacing).toBeDefined();
    });

    it("rejects a phase whose addition could be read as a result", () => {
      // @ts-expect-error -- an addition never carries an outcome
      const outcome = mock<FillPhase<Request, { outcome: "filled" }>>();
      expect(outcome).toBeDefined();
    });
  });

  describe("ending a fill", () => {
    it.each<[StepName, FillResult]>([
      ["target", AUTOFILL_DENIED],
      ["read", AUTOFILL_INVALID],
      ["select", AUTOFILL_DENIED],
      ["reprompt", AUTOFILL_DENIED],
      ["commit", AUTOFILL_DENIED],
    ])("ends the fill when the %s check refuses it", async (name, refusal) => {
      const { calls, steps, run } = harness();
      steps[name].check.mockImplementationOnce(async () => {
        calls.push(`${name}.check`);
        return refusal;
      });

      const result = await run()(request, NEVER_CANCEL);

      expect(result).toBe(refusal);
      expect(calls.at(-1)).toBe(`${name}.check`);
    });

    it.each<[PhaseName, FillResult]>([
      ["target", AUTOFILL_DENIED],
      ["read", AUTOFILL_ABSENT],
      ["select", AUTOFILL_INVALID],
      ["reprompt", AUTOFILL_DENIED],
    ])("ends the fill when the %s execute ends it", async (name, ending) => {
      const { calls, steps, run } = harness();
      steps[name].execute.mockImplementationOnce(async () => {
        calls.push(`${name}.execute`);
        return ending;
      });

      const result = await run()(request, NEVER_CANCEL);

      expect(result).toBe(ending);
      expect(calls.at(-1)).toBe(`${name}.execute`);
    });

    it.each<StepName>([...phaseNames, "commit"])(
      "reports the %s check's refusal as the check reported it, though the token is cancelled",
      async (name) => {
        const { steps, run } = harness();
        const { cancel, token } = cancellationToken();
        steps[name].check.mockImplementationOnce(async () => {
          cancel();
          return AUTOFILL_INVALID;
        });

        const result = await run()(request, token);

        expect(result).toBe(AUTOFILL_INVALID);
      },
    );
  });

  describe("cancellation", () => {
    it("still runs the first check of a fill cancelled before it began", async () => {
      const { calls, run } = harness();
      const { cancel, token } = cancellationToken();
      cancel();

      const result = await run()(request, token);

      expect(result).toBe(AUTOFILL_CANCELLED);
      expect(calls).toEqual(["target.check"]);
    });

    it.each<StepName>([...phaseNames, "commit"])(
      "does not run the %s execute when the token is cancelled during its check",
      async (name) => {
        const { calls, steps, run } = harness();
        const { cancel, token } = cancellationToken();
        steps[name].check.mockImplementationOnce(async () => {
          calls.push(`${name}.check`);
          cancel();
          return undefined;
        });

        const result = await run()(request, token);

        expect(result).toBe(AUTOFILL_CANCELLED);
        expect(calls.at(-1)).toBe(`${name}.check`);
      },
    );

    it.each<[PhaseName, StepName]>([
      ["target", "read"],
      ["read", "select"],
      ["select", "reprompt"],
      ["reprompt", "commit"],
    ])(
      "runs the next check after the %s execute, and not the %s execute, when the token is cancelled during the execute",
      async (name, next) => {
        const { calls, steps, run } = harness();
        const { cancel, token } = cancellationToken();
        steps[name].execute.mockImplementationOnce(async () => {
          calls.push(`${name}.execute`);
          cancel();
          return additionOf[name];
        });

        const result = await run()(request, token);

        expect(result).toBe(AUTOFILL_CANCELLED);
        expect(calls.slice(-2)).toEqual([`${name}.execute`, `${next}.check`]);
      },
    );

    it("keeps the commit's result, and runs the effects, when the token is cancelled during the commit", async () => {
      const { commit, effects, run } = harness();
      const effect = jest.fn(async (): Promise<void> => undefined);
      effects.push(effect);
      const { cancel, token } = cancellationToken();
      commit.execute.mockImplementationOnce(async () => {
        cancel();
        return FILLED;
      });

      const result = await run()(request, token);

      expect(result).toBe(FILLED);
      expect(effect).toHaveBeenCalled();
    });
  });

  describe("effects", () => {
    it("gives each effect the whole context and the result", async () => {
      const { effects, run } = harness();
      const effect = jest.fn(async (): Promise<void> => undefined);
      effects.push(effect);

      await run()(request, NEVER_CANCEL);

      expect(effect).toHaveBeenCalledWith(fullContext, FILLED);
    });

    it("runs each effect after the one before it has finished, and resolves the fill after the last", async () => {
      const { effects, run } = harness();
      const first = deferred();
      const second = jest.fn(async (): Promise<void> => undefined);
      effects.push(() => first.promise, second);
      let settled = false;

      const pending = run()(request, NEVER_CANCEL).then((result) => {
        settled = true;
        return result;
      });
      await flush();
      expect(second).not.toHaveBeenCalled();
      expect(settled).toBe(false);

      first.resolve();
      await pending;
      expect(second).toHaveBeenCalled();
    });

    it.each<[string, FillResult]>([
      ["absent", AUTOFILL_ABSENT],
      ["denied", AUTOFILL_DENIED],
      ["invalid", AUTOFILL_INVALID],
      ["cancelled", AUTOFILL_CANCELLED],
    ])("runs no effect after a commit that was %s", async (_, outcome) => {
      const { effects, run } = harness([outcome]);
      const effect = jest.fn(async (): Promise<void> => undefined);
      effects.push(effect);

      await run()(request, NEVER_CANCEL);

      expect(effect).not.toHaveBeenCalled();
    });

    it("reports a failed effect, runs the rest, and keeps the result", async () => {
      const { effects, effectFailed, run } = harness();
      const error = new Error("effect failed");
      const after = jest.fn(async (): Promise<void> => undefined);
      effects.push(async () => {
        throw error;
      }, after);

      const result = await run()(request, NEVER_CANCEL);

      expect(result).toBe(FILLED);
      expect(effectFailed).toHaveBeenCalledWith(error);
      expect(after).toHaveBeenCalled();
    });
  });

  describe("re-attempt", () => {
    it("re-attempts an absent fill, every phase again, once the re-attempt emits", async () => {
      const { calls, run } = harness([AUTOFILL_ABSENT, FILLED]);
      const reattempt$ = new Subject<void>();

      const pending = run({ reattempt$ })(request, NEVER_CANCEL);
      await flush();
      // It has not re-attempted before the emission.
      expect(calls).toEqual(ATTEMPT);

      reattempt$.next();
      const result = await pending;

      expect(result).toBe(FILLED);
      expect(calls).toEqual([...ATTEMPT, ...ATTEMPT]);
    });

    it("waits for an emission after the absent result, not one before it", async () => {
      const { commit, run } = harness([AUTOFILL_ABSENT, FILLED]);
      const reattempt$ = new Subject<void>();
      commit.execute.mockImplementationOnce(async () => {
        reattempt$.next();
        return AUTOFILL_ABSENT;
      });

      const pending = run({ reattempt$ })(request, NEVER_CANCEL);
      await flush();
      expect(commit.execute).toHaveBeenCalledTimes(1);

      reattempt$.next();
      await pending;
      expect(commit.execute).toHaveBeenCalledTimes(2);
    });

    it("re-attempts an absent fill only once", async () => {
      const { commit, run } = harness([AUTOFILL_ABSENT, AUTOFILL_ABSENT]);
      const reattempt$ = new Subject<void>();

      const pending = run({ reattempt$ })(request, NEVER_CANCEL);
      await flush();
      reattempt$.next();
      await flush();
      reattempt$.next();
      const result = await pending;

      expect(result).toBe(AUTOFILL_ABSENT);
      expect(commit.execute).toHaveBeenCalledTimes(2);
    });

    it("re-attempts a fill that a phase found absent before the commit", async () => {
      const { steps, run } = harness();
      steps.read.execute.mockResolvedValueOnce(AUTOFILL_ABSENT);
      const reattempt$ = new Subject<void>();

      const pending = run({ reattempt$ })(request, NEVER_CANCEL);
      await flush();
      reattempt$.next();
      const result = await pending;

      expect(result).toBe(FILLED);
    });

    it.each<[string, FillResult]>([
      ["filled", FILLED],
      ["denied", AUTOFILL_DENIED],
      ["invalid", AUTOFILL_INVALID],
      ["cancelled", AUTOFILL_CANCELLED],
    ])("does not re-attempt a fill that was %s", async (_, outcome) => {
      const { commit, run } = harness([outcome]);
      const reattempt$ = new Subject<void>();

      const result = await run({ reattempt$ })(request, NEVER_CANCEL);

      expect(result).toBe(outcome);
      expect(commit.execute).toHaveBeenCalledTimes(1);
      expect(reattempt$.observed).toBe(false);
    });

    it("does not re-attempt when the workflow has no re-attempt", async () => {
      const { commit, run } = harness([AUTOFILL_ABSENT, FILLED]);

      const result = await run()(request, NEVER_CANCEL);

      expect(result).toBe(AUTOFILL_ABSENT);
      expect(commit.execute).toHaveBeenCalledTimes(1);
    });

    it("ends the wait when the token is cancelled, and keeps the absent result", async () => {
      const { calls, run } = harness([AUTOFILL_ABSENT, FILLED]);
      const reattempt$ = new Subject<void>();
      const { cancel, token } = cancellationToken();

      const pending = run({ reattempt$ })(request, token);
      await flush();
      cancel();
      const result = await pending;

      expect(result).toBe(AUTOFILL_ABSENT);
      expect(calls).toEqual(ATTEMPT);
      expect(reattempt$.observed).toBe(false);
    });

    it("rejects the fill, and does not re-attempt it, when the re-attempt errors", async () => {
      const { calls, run } = harness([AUTOFILL_ABSENT, FILLED]);
      const error = new Error("wait failed");

      const pending = run({ reattempt$: throwError(() => error) })(request, NEVER_CANCEL);

      await expect(pending).rejects.toBe(error);
      expect(calls).toEqual(ATTEMPT);
    });

    it("keeps the absent result when the re-attempt completes without emitting", async () => {
      const { calls, run } = harness([AUTOFILL_ABSENT, FILLED]);

      const result = await run({ reattempt$: EMPTY })(request, NEVER_CANCEL);

      expect(result).toBe(AUTOFILL_ABSENT);
      expect(calls).toEqual(ATTEMPT);
    });
  });

  describe("failure", () => {
    it("rejects the fill when a phase throws", async () => {
      const { calls, steps, run } = harness();
      const error = new Error("phase failed");
      steps.select.execute.mockRejectedValueOnce(error);

      await expect(run()(request, NEVER_CANCEL)).rejects.toBe(error);
      expect(calls).not.toContain("reprompt.check");
    });

    it("rejects the fill, and runs no effect, when the commit throws", async () => {
      const { commit, effects, run } = harness();
      const effect = jest.fn(async (): Promise<void> => undefined);
      effects.push(effect);
      const error = new Error("commit failed");
      commit.execute.mockRejectedValueOnce(error);

      await expect(run()(request, NEVER_CANCEL)).rejects.toBe(error);
      expect(effect).not.toHaveBeenCalled();
    });
  });
});

/** Lets every pending promise settle. */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** A promise and the function that resolves it. */
function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((settle) => (resolve = settle));
  return { promise, resolve };
}
