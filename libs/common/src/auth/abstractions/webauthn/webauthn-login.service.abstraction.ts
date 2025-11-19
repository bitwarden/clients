import { AuthResult } from "../../models/domain/auth-result";
import { WebAuthnLoginCredentialAssertionOptionsView } from "../../models/view/webauthn-login/webauthn-login-credential-assertion-options.view";
import { WebAuthnLoginCredentialAssertionView } from "../../models/view/webauthn-login/webauthn-login-credential-assertion.view";

/**
 * Service for logging in with WebAuthnLogin credentials.
 */
export abstract class WebAuthnLoginServiceAbstraction {
  /**
   * Gets the credential assertion options needed for initiating the WebAuthn
   * authentication process. It should provide the challenge and other data
   * (whether FIDO2 user verification is required, the relying party id, timeout duration for the process to complete, etc.)
   * for the authenticator.
   */
  abstract getCredentialAssertionOptions(): Promise<WebAuthnLoginCredentialAssertionOptionsView>;

  /**
   * Asserts the credential. This involves user interaction with the authenticator
   * to sign a challenge with a private key (proving ownership of the private key).
   * This will trigger the browsers WebAuthn API to assert a credential. A PRF-output might
   * be included in the response if the authenticator supports it.
   *
   * @param {WebAuthnLoginCredentialAssertionOptionsView} credentialAssertionOptions - The options provided by the
   * `getCredentialAssertionOptions` method, including the challenge and other data.
   * @returns {WebAuthnLoginCredentialAssertionView} The assertion obtained from the authenticator.
   * If the assertion is not successfully obtained, it returns undefined.
   */
  abstract assertCredential(
    credentialAssertionOptions: WebAuthnLoginCredentialAssertionOptionsView,
  ): Promise<WebAuthnLoginCredentialAssertionView | undefined>;

  /**
   * Logs the user in using the assertion obtained from the authenticator.
   * It completes the authentication process if the assertion is successfully validated server side:
   * the server verifies the signed challenge with the corresponding public key.
   *
   * @param {WebAuthnLoginCredentialAssertionView} assertion - The assertion obtained from the authenticator
   * that needs to be validated for login.
   */
  abstract logIn(assertion: WebAuthnLoginCredentialAssertionView): Promise<AuthResult>;

  /**
   * Checks if WebAuthnLogin is available in the current environment.
   */
  abstract available(): Promise<boolean>;
}
