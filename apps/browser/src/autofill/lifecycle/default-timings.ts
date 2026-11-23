import { of } from "rxjs";

import type { AutofillTimings } from "./types";

const SETTLE_MS = 500;
const COOL_DOWN_MS = 15_000;
const SLOW_RENDER_DELAY_MS = 1500;
const TRANSITION_MAX_AGE_MS = 2 * 60 * 1000;

/** The shipped durations. */
export const defaultTimings: AutofillTimings = Object.freeze({
  settleMs$: of(SETTLE_MS),
  coolDownMs$: of(COOL_DOWN_MS),
  slowRenderMs$: of(SLOW_RENDER_DELAY_MS),
  transitionMaxAgeMs$: of(TRANSITION_MAX_AGE_MS),
});
