// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { StateProvider } from "@bitwarden/common/platform/state";

import { GeneratorStrategy } from "../abstractions";
import { DefaultSubaddressOptions } from "../data";
import { EmailCalculator, EmailRandomizer } from "../engine";
import { newDefaultEvaluator } from "../rx";
import { SubaddressGenerationOptions, NoPolicy } from "../types";
import { observe$PerUserId, sharedStateByUserId } from "../util";

import { SUBADDRESS_SETTINGS } from "./storage";

/** Strategy for creating an email subaddress
 *  @remarks The subaddress is the part following the `+`.
 *  For example, if the email address is `jd+xyz@domain.io`,
 *  the subaddress is `xyz`.
 */
export class SubaddressGeneratorStrategy
  implements GeneratorStrategy<SubaddressGenerationOptions, NoPolicy>
{
  /** Instantiates the generation strategy
   *  @param usernameService generates an email subaddress from an email address
   */
  constructor(
    private emailCalculator: EmailCalculator,
    private emailRandomizer: EmailRandomizer,
    private stateProvider: StateProvider,
    private defaultOptions: SubaddressGenerationOptions = DefaultSubaddressOptions,
  ) {}

  // configuration
  durableState = sharedStateByUserId(SUBADDRESS_SETTINGS, this.stateProvider);
  defaults$ = observe$PerUserId(() => this.defaultOptions);
  toEvaluator = newDefaultEvaluator<SubaddressGenerationOptions>();
  readonly policy = PolicyType.PasswordGenerator;

  // algorithm
  async generate(options: SubaddressGenerationOptions) {
    if (options.subaddressType == null) {
      options.subaddressType = "random";
    }

    if (options.subaddressType === "website-name") {
      return this.emailCalculator.appendToSubaddress(options.website, options.subaddressEmail);
    }

    return this.emailRandomizer.randomAsciiSubaddress(options.subaddressEmail);
  }
}
