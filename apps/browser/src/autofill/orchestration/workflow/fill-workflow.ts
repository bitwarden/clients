import { of } from "rxjs";

import { waitFor } from "../../rx";

import type { FillRequestKind } from "./enums";
import { FillReattempt } from "./enums";
import { commitPhase } from "./phases/commit";
import { fillEffect } from "./phases/effects";
import { readPhase } from "./phases/read";
import { repromptPhase } from "./phases/reprompt";
import { invalid } from "./phases/results";
import { selectPhase } from "./phases/select";
import { targetPhase } from "./phases/target";
import { defaultFillTimings, type FillServices, type FillTimings } from "./services";
import type { FillPlan, FillWorkflow } from "./types";
import { workflowEngine } from "./workflow-engine";

const UNACCEPTED_REQUEST = "the plan does not accept a request of this kind";

/**
 * Builds the workflow a plan calls for, each phase from its own sub-plan (see `model.md`, invariant
 * 10). A request of a kind the plan does not accept makes the fill invalid before any phase runs
 * (invariant 14). A slow-render re-attempt waits `timings.slowRenderMs$`. A failed effect is logged
 * as an error.
 */
export function fillWorkflow<Accepts extends FillRequestKind>(
  plan: FillPlan<Accepts>,
  services: FillServices,
  timings: FillTimings = defaultFillTimings,
): FillWorkflow<Accepts> {
  const run = workflowEngine(
    {
      target: targetPhase(plan.target, services),
      read: readPhase(plan.read, services, timings),
      select: selectPhase(plan.select, services),
      reprompt: repromptPhase(plan.reprompt, services),
      commit: commitPhase(plan.commit, services),
      effects: [...plan.effects].map((kind) => fillEffect(kind, services)),
    },
    {
      reattempt$:
        plan.reattempt === FillReattempt.SlowRender
          ? of(undefined).pipe(waitFor(timings.slowRenderMs$))
          : undefined,
      effectFailed: (error) => services.logService.error(error),
    },
  );
  // An untyped caller can still pass any request.
  return async (request, cancellation) =>
    request.kind === plan.accepts
      ? run(request, cancellation)
      : invalid(services.logService, UNACCEPTED_REQUEST);
}
