import { SecurityState } from "../models/security-state";

export class SecurityStateResponse {
  securityState: string;

  constructor(response: any) {
    this.securityState = response.securityState;
  }

  toSerializedSecurityState(): SecurityState {
    return new SecurityState(this.securityState);
  }
}
