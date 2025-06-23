import { SerializedSecurityState } from "../models/security-state";

export class SecurityStateResponseModel {
  securityState: string;

  constructor(response: any) {
    this.securityState = response.securityState;
  }

  toSerializedSecurityState(): SerializedSecurityState {
    return new SerializedSecurityState(this.securityState);
  }
}
