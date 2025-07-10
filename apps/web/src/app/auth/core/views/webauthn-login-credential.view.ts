import { WebauthnLoginCredentialPrfStatus } from "../enums/webauthn-login-credential-prf-status.enum";

export class WebauthnLoginCredentialView {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly prfStatus: WebauthnLoginCredentialPrfStatus,
  ) {}
}
