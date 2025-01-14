// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CredentialAssertionOptionsResponse } from "../../services/webauthn-login/response/credential-assertion-options.response";

export class WebAuthnLoginApiServiceAbstraction {
  getCredentialAssertionOptions: () => Promise<CredentialAssertionOptionsResponse>;
}
