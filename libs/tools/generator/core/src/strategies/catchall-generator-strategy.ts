// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { StateProvider } from "@bitwarden/common/platform/state";

import { GeneratorStrategy } from "../abstractions";
import { DefaultCatchallOptions } from "../data";
import { EmailCalculator, EmailRandomizer } from "../engine";
import { newDefaultEvaluator } from "../rx";
import { NoPolicy, CatchallGenerationOptions } from "../types";
import { observe$PerUserId, sharedStateByUserId } from "../util";

import { CATCHALL_SETTINGS } from "./storage";

/** Strategy for creating usernames using a catchall email address */
export class CatchallGeneratorStrategy
  implements GeneratorStrategy<CatchallGenerationOptions, NoPolicy>
{
  /** Instantiates the generation strategy
   *  @param usernameService generates a catchall address for a domain
   */
  constructor(
    private emailCalculator: EmailCalculator,
    private emailRandomizer: EmailRandomizer,
    private stateProvider: StateProvider,
    private defaultOptions: CatchallGenerationOptions = DefaultCatchallOptions,
  ) {}

  // configuration
  durableState = sharedStateByUserId(CATCHALL_SETTINGS, this.stateProvider);
  defaults$ = observe$PerUserId(() => this.defaultOptions);
  toEvaluator = newDefaultEvaluator<CatchallGenerationOptions>();
  readonly policy = PolicyType.PasswordGenerator;

  // algorithm
  async generate(options: CatchallGenerationOptions) {
    if (options.catchallType == null) {
      options.catchallType = "random";
    }

    if (options.catchallType === "website-name") {
      return await this.emailCalculator.concatenate(options.website, options.catchallDomain);
    }

    return this.emailRandomizer.randomAsciiCatchall(options.catchallDomain);
  }
}
