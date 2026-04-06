import { Constraints, StateConstraints } from "@bitwarden/common/tools/types";

import { SubaddressGenerationOptions } from "../types";

/** A constraint that sets the subaddress email using a fixed email address */
export class SubaddressConstraints implements StateConstraints<SubaddressGenerationOptions> {
  /** Creates a catchall constraints
   * @param email - the email address containing the domain.
   */
  constructor(readonly email: string) {
    if (!email) {
      this.email = "";
    }
  }

  constraints: Readonly<Constraints<SubaddressGenerationOptions>> = {};

  adjust(state: SubaddressGenerationOptions) {
    const currentDomain = (state.subaddressEmail ?? "").trim();

    if (currentDomain !== "") {
      return state;
    }

    const options = { ...state };
    options.subaddressEmail = this.email;

    return options;
  }

  fix(state: SubaddressGenerationOptions) {
    return state;
  }
}
