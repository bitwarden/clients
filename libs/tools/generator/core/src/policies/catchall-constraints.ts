// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Constraints, StateConstraints } from "@bitwarden/common/tools/types";

import { CatchallGenerationOptions } from "../types";

/** Parses the domain part of an email address
 */
const DOMAIN_PARSER = new RegExp("[^@]+@(?<domain>.+)");

/** A constraint that sets the catchall domain using a fixed email address */
export class CatchallConstraints implements StateConstraints<CatchallGenerationOptions> {
  /** Creates a catchall constraints
   * @param email - the email address containing the domain.
   */
  constructor(email: string) {
    if (!email) {
      this.domain = "";
      return;
    }

    const parsed = DOMAIN_PARSER.exec(email);
    if (parsed && parsed.groups?.domain) {
      this.domain = parsed.groups.domain;
    }
  }
  readonly domain: string;

  constraints: Readonly<Constraints<CatchallGenerationOptions>> = {};

  adjust(state: CatchallGenerationOptions) {
    const currentDomain = (state.catchallDomain ?? "").trim();

    if (currentDomain !== "") {
      return state;
    }

    const options = { ...state };
    options.catchallDomain = this.domain;

    return options;
  }

  fix(state: CatchallGenerationOptions) {
    return state;
  }
}
