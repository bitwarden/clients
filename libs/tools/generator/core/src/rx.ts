import { map, pipe } from "rxjs";

import { reduceCollection, distinctIfShallowMatch } from "@bitwarden/common/tools/rx";

import { DefaultPolicyEvaluator } from "./policies";
import { PolicyConfiguration } from "./types";

/** Maps an administrative console policy to a policy evaluator using the provided configuration.
 *  @param configuration the configuration that constructs the evaluator.
 */
export function mapPolicyToEvaluator<Policy, Evaluator>(
  configuration: PolicyConfiguration<Policy, Evaluator>,
) {
  return pipe(
    reduceCollection(configuration.combine, configuration.disabledValue),
    distinctIfShallowMatch(),
    map(configuration.createEvaluator),
  );
}

/** Constructs a method that maps a policy to the default (no-op) policy. */
export function newDefaultEvaluator<Target>() {
  return () => {
    return pipe(map((_) => new DefaultPolicyEvaluator<Target>()));
  };
}
