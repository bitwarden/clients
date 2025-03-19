// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { WebAuthnLoginAssertionResponseRequest } from "@bitwarden/common/auth/services/webauthn-login/request/webauthn-login-assertion-response.request";

/**
 * Request sent to the server to save a newly created prf key set for a credential.
 */
export class EnableCredentialEncryptionRequest {
  /**
   * The response received from the authenticator.
   */
  deviceResponse: WebAuthnLoginAssertionResponseRequest;

  /**
   * An encrypted token containing information the server needs to verify the credential.
   */
  token: string;

  /** Used for vault encryption. See {@link RotateableKeySet.encryptedUserKey } */
  encryptedUserKey?: string;

  /** Used for vault encryption. See {@link RotateableKeySet.encryptedPublicKey } */
  encryptedPublicKey?: string;

  /** Used for vault encryption. See {@link RotateableKeySet.encryptedPrivateKey } */
  encryptedPrivateKey?: string;
}
