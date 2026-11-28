import { firstValueFrom, map, takeUntil } from "rxjs";

import { AutofillOutcome } from "../../enums/autofill-outcome.enum";
import type { CancellationToken } from "../../utils/cancellation";
import type { FillResult } from "../types";
import { AUTOFILL_CANCELLED, isFillResult } from "../utils";

import type { FillRequest } from "./context";
import type {
  Addition,
  FillEffect,
  FillFilled,
  FillPhase,
  FillPhases,
  FillWorkflow,
  WorkflowEngineOptions,
} from "./types";

/**
 * Builds a workflow that runs `phases`, in their fixed order, for each fill. See `model.md`.
 *
 * The workflow stops a fill at the first phase that ends it, and reports that phase's result. It
 * looks at the cancellation token before each execute, and ends a cancelled fill there. The commit's
 * execute is the point of no return. The effects follow a commit that filled, and the fill resolves
 * once they have run. An effect that throws is passed to `options.effectFailed`, and does not reject
 * the fill. An absent fill is re-attempted at most once, as `options.reattempt$` says.
 *
 * A phase that throws rejects the fill. So does an error that ends the re-attempt's wait, in place
 * of the re-attempt.
 */
export function workflowEngine(phases: FillPhases, options: WorkflowEngineOptions): FillWorkflow {
  const attempt = async (
    request: FillRequest,
    cancellation: CancellationToken,
  ): Promise<FillResult> => {
    const targeted = await advance(phases.target, request, cancellation);
    if (isFillResult(targeted)) {
      return targeted;
    }
    const read = await advance(phases.read, targeted, cancellation);
    if (isFillResult(read)) {
      return read;
    }
    const selected = await advance(phases.select, read, cancellation);
    if (isFillResult(selected)) {
      return selected;
    }
    const reprompted = await advance(phases.reprompt, selected, cancellation);
    if (isFillResult(reprompted)) {
      return reprompted;
    }

    const stopped = await phases.commit.check(reprompted, cancellation);
    if (stopped) {
      return stopped;
    }
    // The commit's look. Nothing waits between it and the commit.
    if (cancellation.cancelled) {
      return AUTOFILL_CANCELLED;
    }
    const result = await phases.commit.execute(reprompted);

    if (filled(result)) {
      await runEffects(phases.effects, reprompted, result, options.effectFailed);
    }
    return result;
  };

  return async (request, cancellation) => {
    const result = await attempt(request, cancellation);
    if (result.outcome !== AutofillOutcome.Absent || !options.reattempt$) {
      return result;
    }

    const due = await firstValueFrom(
      options.reattempt$.pipe(
        map(() => true),
        takeUntil(cancellation.cancelled$),
      ),
      { defaultValue: false },
    );
    // A wait that ended without its emission ends the fill as it was.
    return due ? attempt(request, cancellation) : result;
  };
}

/**
 * Runs one phase: its check, the look, and its execute. Resolves to the context with what the
 * phase added, or to the result that ends the fill.
 */
async function advance<In extends object, Out extends Addition<In>>(
  phase: FillPhase<In, Out>,
  context: In,
  cancellation: CancellationToken,
): Promise<(In & Out) | FillResult> {
  const stopped = await phase.check(context, cancellation);
  if (stopped) {
    return stopped;
  }
  if (cancellation.cancelled) {
    return AUTOFILL_CANCELLED;
  }
  const output = await phase.execute(context, cancellation);
  if (isFillResult(output)) {
    return output;
  }
  // The context only grows: what the request and earlier phases hold outranks what this phase
  // returns. `Addition` forbids the overlap; this keeps it from reaching the context regardless.
  return { ...output, ...context };
}

/** Whether a commit filled. */
function filled(result: FillResult): result is FillFilled {
  return result.outcome === AutofillOutcome.Filled;
}

/**
 * Runs the effects. Neither their order nor whether they overlap is guaranteed (see `model.md`,
 * invariant 8). A failed effect is reported, and the others still run.
 */
async function runEffects<In extends object>(
  effects: readonly FillEffect<In>[],
  context: In,
  result: FillFilled,
  effectFailed: (error: unknown) => void,
): Promise<void> {
  for (const effect of effects) {
    try {
      await effect(context, result);
    } catch (error) {
      effectFailed(error);
    }
  }
}
