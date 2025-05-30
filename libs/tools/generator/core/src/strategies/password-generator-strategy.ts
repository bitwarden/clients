import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { StateProvider } from "@bitwarden/common/platform/state";

import { GeneratorStrategy } from "../abstractions";
import { DefaultPasswordGenerationOptions } from "../data";
import { PasswordRandomizer } from "../engine";
import { PasswordGeneratorOptionsEvaluator, passwordLeastPrivilege } from "../policies";
import { mapPolicyToEvaluator } from "../rx";
import { PasswordGenerationOptions, PasswordGeneratorPolicy } from "../types";
import { observe$PerUserId, optionsToRandomAsciiRequest, sharedStateByUserId } from "../util";

import { PASSWORD_SETTINGS } from "./storage";

/** Generates passwords composed of random characters */
export class PasswordGeneratorStrategy
  implements GeneratorStrategy<PasswordGenerationOptions, PasswordGeneratorPolicy>
{
  /** instantiates the password generator strategy.
   *  @param legacy generates the password
   */
  constructor(
    private randomizer: PasswordRandomizer,
    private stateProvider: StateProvider,
  ) {}

  // configuration
  durableState = sharedStateByUserId(PASSWORD_SETTINGS, this.stateProvider);
  defaults$ = observe$PerUserId(() => DefaultPasswordGenerationOptions);
  readonly policy = PolicyType.PasswordGenerator;
  toEvaluator() {
    return mapPolicyToEvaluator({
      type: PolicyType.PasswordGenerator,
      disabledValue: {
        minLength: 0,
        useUppercase: false,
        useLowercase: false,
        useNumbers: false,
        numberCount: 0,
        useSpecial: false,
        specialCount: 0,
      },
      combine: passwordLeastPrivilege,
      createEvaluator: (policy) => new PasswordGeneratorOptionsEvaluator(policy),
    });
  }

  // algorithm
  async generate(options: PasswordGenerationOptions): Promise<string> {
    const request = optionsToRandomAsciiRequest(options);
    const result = await this.randomizer.randomAscii(request);

    return result;
  }
}
