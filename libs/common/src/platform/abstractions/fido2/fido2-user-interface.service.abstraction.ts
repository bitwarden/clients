/**
 * Parameters used to ask the user to confirm the creation of a new credential.
 */
export interface NewCredentialParams {
  /**
   * The name of the credential.
   */
  credentialName: string;

  /**
   * The name of the user.
   */
  userName: string;

  /**
   * The userhandle (userid) of the user.
   */
  userHandle: string;

  /**
   * Whether or not the user must be verified before completing the operation.
   */
  userVerification: boolean;
  /**
   * The relying party ID is usually the URL
   */
  rpId: string;
}

/**
 * Parameters used to ask the user to pick a credential from a list of existing credentials.
 */
export interface PickCredentialParams {
  /**
   * The IDs of the credentials that the user can pick from.
   */
  cipherIds: string[];

  /**
   * Whether or not the user must be verified before completing the operation.
   */
  userVerification: boolean;
}

/**
 * This service is used to provide a user interface with which the user can control FIDO2 operations.
 * It acts as a way to remote control the user interface from the background script.
 *
 * The service is session based and is intended to be used by the FIDO2 authenticator to open a window,
 * and then use this window to ask the user for input and/or display messages to the user.
 */
export abstract class Fido2UserInterfaceService {
  /**
   * Creates a new session.
   * Note: This will not necessarily open a window until it is needed to request something from the user.
   *
   * @param fallbackSupported Whether or not the browser natively supports WebAuthn.
   * @param abortController An abort controller that can be used to cancel/close the session.
   */
  newSession: (
    fallbackSupported: boolean,
    tab: chrome.tabs.Tab,
    abortController?: AbortController,
  ) => Promise<Fido2UserInterfaceSession>;
}

export abstract class Fido2UserInterfaceSession {
  /**
   * Ask the user to pick a credential from a list of existing credentials.
   *
   * @param params The parameters to use when asking the user to pick a credential.
   * @param abortController An abort controller that can be used to cancel/close the session.
   * @returns The ID of the cipher that contains the credentials the user picked.
   */
  pickCredential: (
    params: PickCredentialParams,
  ) => Promise<{ cipherId: string; userVerified: boolean }>;

  /**
   * Ask the user to confirm the creation of a new credential.
   *
   * @param params The parameters to use when asking the user to confirm the creation of a new credential.
   * @param abortController An abort controller that can be used to cancel/close the session.
   * @returns The ID of the cipher where the new credential should be saved.
   */
  confirmNewCredential: (
    params: NewCredentialParams,
  ) => Promise<{ cipherId: string; userVerified: boolean }>;

  /**
   * Make sure that the vault is unlocked.
   * This will open a window and ask the user to login or unlock the vault if necessary.
   */
  ensureUnlockedVault: () => Promise<void>;

  /**
   * Inform the user that the operation was cancelled because their vault contains excluded credentials.
   *
   * @param existingCipherIds The IDs of the excluded credentials.
   */
  informExcludedCredential: (existingCipherIds: string[]) => Promise<void>;

  /**
   * Inform the user that the operation was cancelled because their vault does not contain any useable credentials.
   */
  informCredentialNotFound: (abortController?: AbortController) => Promise<void>;

  /**
   * Close the session, including any windows that may be open.
   */
  close: () => void;
}
