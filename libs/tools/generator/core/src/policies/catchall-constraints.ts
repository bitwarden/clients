import { Constraints, StateConstraints, WithConstraints } from "@bitwarden/common/tools/types";
import { unconstrained } from "@bitwarden/common/tools/util";

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
    this.domain = parsed?.groups?.domain ?? "";
  }
  readonly domain: string;

  constraints: Readonly<Constraints<CatchallGenerationOptions>> = {};

  adjust(state: CatchallGenerationOptions): WithConstraints<CatchallGenerationOptions> {
    const currentDomain = (state.catchallDomain ?? "").trim();

    if (currentDomain !== "") {
      return { state, constraints: this.constraints, applied: unconstrained() };
    }

    const result = { ...state };
    result.catchallDomain = this.domain;

    return {
      state: result,
      constraints: this.constraints,
      applied: { catchallDomain: {} },
    };
  }

  fix(state: CatchallGenerationOptions): WithConstraints<CatchallGenerationOptions> {
    return { state, constraints: this.constraints, applied: unconstrained() };
  }
}
