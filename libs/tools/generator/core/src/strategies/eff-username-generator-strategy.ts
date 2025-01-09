import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { StateProvider } from "@bitwarden/common/platform/state";

import { GeneratorStrategy } from "../abstractions";
import { DefaultEffUsernameOptions, UsernameDigits } from "../data";
import { UsernameRandomizer } from "../engine";
import { newDefaultEvaluator } from "../rx";
import { EffUsernameGenerationOptions, NoPolicy } from "../types";
import { observe$PerUserId, sharedStateByUserId } from "../util";

import { EFF_USERNAME_SETTINGS } from "./storage";

/** Strategy for creating usernames from the EFF wordlist */
export class EffUsernameGeneratorStrategy
  implements GeneratorStrategy<EffUsernameGenerationOptions, NoPolicy>
{
  /** Instantiates the generation strategy
   *  @param usernameService generates a username from EFF word list
   */
  constructor(
    private randomizer: UsernameRandomizer,
    private stateProvider: StateProvider,
    private defaultOptions: EffUsernameGenerationOptions = DefaultEffUsernameOptions,
  ) {}

  // configuration
  durableState = sharedStateByUserId(EFF_USERNAME_SETTINGS, this.stateProvider);
  defaults$ = observe$PerUserId(() => this.defaultOptions);
  toEvaluator = newDefaultEvaluator<EffUsernameGenerationOptions>();
  readonly policy = PolicyType.PasswordGenerator;

  // algorithm
  async generate(options: EffUsernameGenerationOptions) {
    const casing =
      (options.wordCapitalize ?? DefaultEffUsernameOptions.wordCapitalize)
        ? "TitleCase"
        : "lowercase";
    const digits =
      (options.wordIncludeNumber ?? DefaultEffUsernameOptions.wordIncludeNumber)
        ? UsernameDigits.enabled
        : UsernameDigits.disabled;
    const word = await this.randomizer.randomWords({ numberOfWords: 1, casing, digits });
    return word;
  }
}
