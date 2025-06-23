export class SecurityStateRequest {
  securityState: string;
  securityVersion: number;

  constructor(securityState: string, securityVersion: number) {
    this.securityState = securityState;
    this.securityVersion = securityVersion;
  }
}
