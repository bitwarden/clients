import { CredentialCreateOptionsView } from "./credential-create-options.view";

/**
 * Represents a WebAuthn credential that has been created by an authenticator but not yet saved to the server.
 */
export class PendingWebauthnLoginCredentialView {
  constructor(
    readonly createOptions: CredentialCreateOptionsView,
    readonly deviceResponse: PublicKeyCredential,
    readonly supportsPrf: boolean,
  ) {}
}
