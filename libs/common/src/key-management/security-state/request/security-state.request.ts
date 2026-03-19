import { SignedSecurityState } from "../../types";

export class SecurityStateRequest {
  constructor(
    readonly securityState: SignedSecurityState,
    readonly securityVersion: number,
  ) {}
}
