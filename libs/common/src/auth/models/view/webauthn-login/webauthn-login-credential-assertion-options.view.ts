import { AssertionOptionsResponse } from "../../../services/webauthn-login/response/assertion-options.response";

export class WebAuthnLoginCredentialAssertionOptionsView {
  constructor(
    readonly options: AssertionOptionsResponse,
    readonly token: string,
  ) {}
}
