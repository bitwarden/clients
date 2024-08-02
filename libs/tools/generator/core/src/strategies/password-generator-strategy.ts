import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { StateProvider } from "@bitwarden/common/platform/state";

import { GeneratorStrategy } from "../abstractions";
import { Policies, DefaultPasswordGenerationOptions } from "../data";
import { PasswordRandomizer } from "../engine";
import { mapPolicyToEvaluator } from "../rx";
import { PasswordGenerationOptions, PasswordGeneratorPolicy } from "../types";
import { observe$PerUserId, sharedStateByUserId, sum } from "../util";

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
    // converts password generation option sets, which are defined by
    // an "enabled" and "quantity" parameter, to the password engine's
    // parameters, which represent disabled options as `undefined`
    // properties.
    function process(
      // values read from the options
      enabled: boolean,
      quantity: number,
      // value used if an option is missing
      defaultEnabled: boolean,
      defaultQuantity: number,
    ) {
      const isEnabled = enabled ?? defaultEnabled;
      const actualQuantity = quantity ?? defaultQuantity;
      const result = isEnabled ? actualQuantity : undefined;

      return result;
    }

    const request = {
      uppercase: process(
        options.uppercase,
        options.minUppercase,
        DefaultPasswordGenerationOptions.uppercase,
        DefaultPasswordGenerationOptions.minUppercase,
      ),
      lowercase: process(
        options.lowercase,
        options.minLowercase,
        DefaultPasswordGenerationOptions.lowercase,
        DefaultPasswordGenerationOptions.minLowercase,
      ),
      digits: process(
        options.number,
        options.minNumber,
        DefaultPasswordGenerationOptions.number,
        DefaultPasswordGenerationOptions.minNumber,
      ),
      special: process(
        options.special,
        options.minSpecial,
        DefaultPasswordGenerationOptions.special,
        DefaultPasswordGenerationOptions.minSpecial,
      ),
      ambiguous: options.ambiguous ?? DefaultPasswordGenerationOptions.ambiguous,
      all: 0,
    };

    // engine represents character sets as "include only"; you assert how many all
    // characters there can be rather than a total length. This conversion has
    // the character classes win, so that the result is always consistent with policy
    // minimums.
    const required = sum(request.uppercase, request.lowercase, request.digits, request.special);
    const remaining = (options.length ?? 0) - required;
    request.all = Math.max(remaining, 0);

    const result = await this.randomizer.randomAscii(request);

    return result;
  }
}
