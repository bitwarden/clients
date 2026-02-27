import {
  DynamicStateConstraints,
  PolicyConstraints,
  StateConstraints,
} from "@bitwarden/common/tools/types";

/** Specializes state constraints to include policy. */
export type GeneratorConstraints<Settings> = { constraints: PolicyConstraints<Settings> } & (
  | DynamicStateConstraints<Settings>
  | StateConstraints<Settings>
);
