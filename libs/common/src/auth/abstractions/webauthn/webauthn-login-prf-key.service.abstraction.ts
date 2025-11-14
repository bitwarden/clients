import { PrfKey } from "../../../types/key";

/**
 * Contains methods for all crypto operations specific to the WebAuthn login flow.
 */
export abstract class WebAuthnLoginPrfKeyServiceAbstraction {
  /**
   * Get the salt used to generate the PRF-output used when logging in with WebAuthn.
   */
  abstract getLoginWithPrfSalt(): Promise<ArrayBuffer>;

  /**
   * Create a symmetric key from the PRF-output by stretching it.
   * This should be used as `UpstreamKey` with `RotateableKeySet`.
   */
  abstract createSymmetricKeyFromPrf(prf: ArrayBuffer): Promise<PrfKey>;
}
