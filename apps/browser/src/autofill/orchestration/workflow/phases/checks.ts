import type { FillPhase, NoAddition } from "../types";

/** The check of a phase that has no preconditions. It always passes. */
export const NO_CHECK: FillPhase<object, NoAddition>["check"] = async () => undefined;
