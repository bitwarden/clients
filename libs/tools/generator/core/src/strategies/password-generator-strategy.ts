import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { StateProvider } from "@bitwarden/common/platform/state";

import { GeneratorStrategy } from "../abstractions";
import { Policies, DefaultPasswordGenerationOptions } from "../data";
import { PasswordRandomizer } from "../engine";
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
    return mapPolicyToEvaluator(Policies.Password);
  }

  // algorithm
  async generate(options: PasswordGenerationOptions): Promise<string> {
    const request = optionsToRandomAsciiRequest(options);
    const result = await this.randomizer.randomAscii(request);

    return result;
  }
}
