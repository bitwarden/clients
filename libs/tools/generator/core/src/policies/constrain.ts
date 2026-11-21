import { isDynamic } from "@bitwarden/common/tools/state/state-constraints-dependency";
import { WithConstraints } from "@bitwarden/common/tools/types";

import { GeneratorConstraints } from "../types/generator-constraints";

/** Applies policy to `state` the same way `UserStateSubject` does for stored settings. */
export function constrain<Settings>(
  constraints: GeneratorConstraints<Settings>,
  state: Settings,
): WithConstraints<Settings> {
  const calibration = isDynamic(constraints) ? constraints.calibrate(state) : constraints;
  return { state: calibration.adjust(state), constraints: calibration.constraints };
}
