// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { StateProvider } from "@bitwarden/common/platform/state";

import { GeneratorStrategy } from "../abstractions";
import { DefaultPassphraseGenerationOptions } from "../data";
import { PasswordRandomizer } from "../engine";
import { PassphraseGeneratorOptionsEvaluator, passphraseLeastPrivilege } from "../policies";
import { mapPolicyToEvaluator } from "../rx";
import { PassphraseGenerationOptions, PassphraseGeneratorPolicy } from "../types";
import { observe$PerUserId, optionsToEffWordListRequest, sharedStateByUserId } from "../util";

import { PASSPHRASE_SETTINGS } from "./storage";

/** Generates passphrases composed of random words */
export class PassphraseGeneratorStrategy
  implements GeneratorStrategy<PassphraseGenerationOptions, PassphraseGeneratorPolicy>
{
  /** instantiates the password generator strategy.
   *  @param legacy generates the passphrase
   *  @param stateProvider provides durable state
   */
  constructor(
    private randomizer: PasswordRandomizer,
    private stateProvider: StateProvider,
  ) {}

  // configuration
  durableState = sharedStateByUserId(PASSPHRASE_SETTINGS, this.stateProvider);
  defaults$ = observe$PerUserId(() => DefaultPassphraseGenerationOptions);
  readonly policy = PolicyType.PasswordGenerator;
  toEvaluator() {
    return mapPolicyToEvaluator({
      type: PolicyType.PasswordGenerator,
      disabledValue: Object.freeze({
        minNumberWords: 0,
        capitalize: false,
        includeNumber: false,
      }),
      combine: passphraseLeastPrivilege,
      createEvaluator: (policy) => new PassphraseGeneratorOptionsEvaluator(policy),
    });
  }

  // algorithm
  async generate(options: PassphraseGenerationOptions): Promise<string> {
    const request = optionsToEffWordListRequest(options);

    return this.randomizer.randomEffLongWords(request);
  }
}
