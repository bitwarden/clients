// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { WebauthnLoginAttestationResponseRequest } from "./webauthn-login-attestation-response.request";

/**
 * Request sent to the server to save a newly created webauthn login credential.
 */
export class SaveCredentialRequest {
  /**
   * The response received from the authenticator.
   * This contains all information needed for future authentication flows.
   */
  deviceResponse: WebauthnLoginAttestationResponseRequest;

  /** Nickname chosen by the user to identify this credential */
  name: string;

  /**
   * Token required by the server to complete the creation.
   * It contains encrypted information that the server needs to verify the credential.
   */
  token: string;

  /**
   * True if the credential was created with PRF support.
   */
  supportsPrf: boolean;

  /** Used for vault encryption. See {@link RotateableKeySet.encryptedUserKey } */
  encryptedUserKey?: string;

  /** Used for vault encryption. See {@link RotateableKeySet.encryptedPublicKey } */
  encryptedPublicKey?: string;

  /** Used for vault encryption. See {@link RotateableKeySet.encryptedPrivateKey } */
  encryptedPrivateKey?: string;
}
