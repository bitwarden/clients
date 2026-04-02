import {
  Constraints,
  PolicyConstraints,
  StateConstraints,
  WithConstraints,
} from "@bitwarden/common/tools/types";
import { unconstrained } from "@bitwarden/common/tools/util";

import { PasswordGeneratorSettings } from "../types";

import { fitToBounds, enforceConstant } from "./constraints";

export class PasswordPolicyConstraints implements StateConstraints<PasswordGeneratorSettings> {
  /** Creates a password policy constraints
   *  @param constraints Constraints derived from the policy and application-defined defaults
   */
  constructor(readonly constraints: PolicyConstraints<PasswordGeneratorSettings>) {}

  adjust(state: PasswordGeneratorSettings): WithConstraints<PasswordGeneratorSettings> {
    // constrain values; fall back to hardcoded defaults when state fields are undefined
    const length = fitToBounds(state.length ?? 14, this.constraints.length!);
    const lowercase =
      enforceConstant(state.lowercase ?? true, this.constraints.lowercase!) ?? false;
    const uppercase =
      enforceConstant(state.uppercase ?? true, this.constraints.uppercase!) ?? false;
    const number = enforceConstant(state.number ?? true, this.constraints.number!) ?? false;
    const special = enforceConstant(state.special ?? false, this.constraints.special!) ?? false;
    const minLowercase = fitToBounds(state.minLowercase ?? 0, this.constraints.minLowercase!);
    const minUppercase = fitToBounds(state.minUppercase ?? 0, this.constraints.minUppercase!);
    const minNumber = fitToBounds(state.minNumber ?? 0, this.constraints.minNumber!);
    const minSpecial = fitToBounds(state.minSpecial ?? 0, this.constraints.minSpecial!);
    const ambiguous = state.ambiguous ?? true;

    const result: PasswordGeneratorSettings = {
      length,
      lowercase: lowercase || minLowercase > 0,
      uppercase: uppercase || minUppercase > 0,
      number: number || minNumber > 0,
      special: special || minSpecial > 0,
      minLowercase,
      minUppercase,
      minNumber,
      minSpecial,
      ambiguous,
    };

    // when all flags are disabled, enable a few
    const anyEnabled = [result.lowercase, result.uppercase, result.number, result.special].some(
      (flag) => flag,
    );
    if (!anyEnabled) {
      result.lowercase = true;
      result.uppercase = true;
    }

    // compute applied constraints (only fields that changed)
    const applied: Constraints<PasswordGeneratorSettings> = {};
    const keys: (keyof PasswordGeneratorSettings)[] = [
      "length",
      "lowercase",
      "uppercase",
      "number",
      "special",
      "minLowercase",
      "minUppercase",
      "minNumber",
      "minSpecial",
      "ambiguous",
    ];
    for (const key of keys) {
      if (state[key] !== result[key] && this.constraints[key] != null) {
        (applied as any)[key] = this.constraints[key];
      }
    }

    return {
      state: result,
      constraints: this.constraints,
      applied: Object.keys(applied).length > 0 ? applied : unconstrained(),
    };
  }

  fix(state: PasswordGeneratorSettings): WithConstraints<PasswordGeneratorSettings> {
    return { state, constraints: this.constraints, applied: unconstrained() };
  }
}
