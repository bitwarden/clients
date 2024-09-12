import { PolicyConstraints, StateConstraints } from "@bitwarden/common/tools/types";

import { DefaultPasswordGenerationOptions } from "../data";
import { PasswordGeneratorSettings } from "../types";

import { fitToBounds, enforceConstant } from "./constraints";

export class PasswordPolicyConstraints implements StateConstraints<PasswordGeneratorSettings> {
  /** Creates a password policy constraints
   *  @param constraints Constraints derived from the policy and application-defined defaults
   */
  constructor(readonly constraints: PolicyConstraints<PasswordGeneratorSettings>) {}

  adjust(state: PasswordGeneratorSettings): PasswordGeneratorSettings {
    // constrain values
    const result: PasswordGeneratorSettings = {
      ...(state ?? DefaultPasswordGenerationOptions),
      length: fitToBounds(state.length, this.constraints.length),
      lowercase: enforceConstant(state.lowercase, this.constraints.lowercase),
      uppercase: enforceConstant(state.uppercase, this.constraints.uppercase),
      number: enforceConstant(state.number, this.constraints.number),
      special: enforceConstant(state.special, this.constraints.special),
      minLowercase: fitToBounds(state.minLowercase, this.constraints.minLowercase),
      minUppercase: fitToBounds(state.minUppercase, this.constraints.minUppercase),
      minNumber: fitToBounds(state.minNumber, this.constraints.minNumber),
      minSpecial: fitToBounds(state.minSpecial, this.constraints.minSpecial),
    };

    // ensure include flags are consistent with the constrained values
    result.lowercase ||= state.minLowercase > 0;
    result.uppercase ||= state.minUppercase > 0;
    result.number ||= state.minNumber > 0;
    result.special ||= state.minSpecial > 0;

    return result;
  }

  fix(state: PasswordGeneratorSettings): PasswordGeneratorSettings {
    return state;
  }
}
