import { SignedSecurityState } from "../../types";

export class SecurityStateResponse {
  readonly securityState: SignedSecurityState | null = null;

  constructor(response: unknown) {
    if (typeof response !== "object" || response == null) {
      throw new TypeError("Response must be an object");
    }

    if (!("securityState" in response) || !(typeof response.securityState === "string")) {
      throw new TypeError("Response must contain a valid securityState");
    }
    this.securityState = response.securityState as SignedSecurityState;
  }
}
