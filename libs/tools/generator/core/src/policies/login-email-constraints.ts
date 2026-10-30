import { Constraints, StateConstraints } from "@bitwarden/common/tools/types";

import { LoginEmailGenerationOptions } from "../types";

/** A constraint that sets the login email using the account's verified email address */
export class LoginEmailConstraints implements StateConstraints<LoginEmailGenerationOptions> {
  /** Creates a login email constraint
   * @param email - the account's verified email address
   */
  constructor(readonly email: string) {}

  constraints: Readonly<Constraints<LoginEmailGenerationOptions>> = {};

  adjust(state: LoginEmailGenerationOptions): LoginEmailGenerationOptions {
    if ((state.email ?? "").trim() !== "") {
      return state;
    }
    return { ...state, email: this.email };
  }

  fix(state: LoginEmailGenerationOptions): LoginEmailGenerationOptions {
    return state;
  }
}
