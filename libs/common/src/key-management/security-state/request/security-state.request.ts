export class SecurityStateRequestModel {
  securityState: string;
  securityVersion: number;

  constructor(securityState: string, securityVersion: number) {
    this.securityState = securityState;
    this.securityVersion = securityVersion;
  }
}
