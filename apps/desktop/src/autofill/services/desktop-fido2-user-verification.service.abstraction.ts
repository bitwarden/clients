/** The step of a passkey ceremony that verification is being performed for. */
export type Fido2UserVerificationOperation = "registration" | "overwrite" | "assertion";

export type Fido2UserVerificationRequest = {
  operation: Fido2UserVerificationOperation;

  /** RP ID of the request. Shown to the user in the OS prompt. */
  rpId: string;

  /** Username of the credential in use. Shown to the user in the OS prompt. */
  username: string;

  /**
   * Native handle of the window the OS prompt should attach to: Bitwarden's
   * window while our own UI is showing, otherwise the calling client's window.
   * Null on platforms that don't attach the prompt to a window.
   */
  windowHandle: Uint8Array | null;

  /**
   * OS-specific context binding this prompt to the in-flight WebAuthn request.
   * Empty on platforms that don't require it.
   */
  requestContext: string;
};

/** Verifies the user through the operating system during a passkey ceremony. */
export abstract class DesktopFido2UserVerificationService {
  /**
   * Prompts the user to verify themselves.
   *
   * @returns whether the user was verified.
   * @throws {UserVerificationCanceled} if the user dismissed the prompt.
   */
  abstract verify(
    request: Fido2UserVerificationRequest,
    options: { signal: AbortSignal },
  ): Promise<boolean>;
}

/**
 * Thrown when the user dismisses the OS verification prompt.
 *
 * Dismissal ends the ceremony rather than falling back to another verification
 * method: the user can retry from the relying party if they didn't mean it.
 */
export class UserVerificationCanceled extends Error {
  constructor() {
    super("The user dismissed the user verification prompt");
    this.name = "UserVerificationCanceled";
  }
}
