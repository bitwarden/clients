import { CredentialAssertionOptionsResponse } from "../../services/webauthn-login/response/credential-assertion-options.response";

export abstract class WebAuthnLoginApiServiceAbstraction {
  abstract getCredentialAssertionOptions(): Promise<CredentialAssertionOptionsResponse>;
}
