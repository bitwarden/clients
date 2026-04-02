import { Constraints, StateConstraints, WithConstraints } from "@bitwarden/common/tools/types";
import { unconstrained } from "@bitwarden/common/tools/util";

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

  adjust(state: SubaddressGenerationOptions): WithConstraints<SubaddressGenerationOptions> {
    const currentDomain = (state.subaddressEmail ?? "").trim();

    if (currentDomain !== "") {
      return { state, constraints: this.constraints, applied: unconstrained() };
    }

    const result = { ...state };
    result.subaddressEmail = this.email;

    return {
      state: result,
      constraints: this.constraints,
      applied: { subaddressEmail: {} },
    };
  }

  fix(state: SubaddressGenerationOptions): WithConstraints<SubaddressGenerationOptions> {
    return { state, constraints: this.constraints, applied: unconstrained() };
  }
}
