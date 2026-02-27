import { PrfKey } from "../../../../types/key";
import { WebAuthnLoginAssertionResponseRequest } from "../../../services/webauthn-login/request/webauthn-login-assertion-response.request";

export class WebAuthnLoginCredentialAssertionView {
  constructor(
    readonly token: string,
    readonly deviceResponse: WebAuthnLoginAssertionResponseRequest,
    readonly prfKey?: PrfKey,
  ) {}
}
