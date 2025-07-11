import { SignedSecurityState } from "../models/security-state";

export class SecurityStateResponse {
  securityState: string;

  constructor(response: any) {
    this.securityState = response.securityState;
  }

  toSerializedSecurityState(): SignedSecurityState {
    return new SignedSecurityState(this.securityState);
  }
}
