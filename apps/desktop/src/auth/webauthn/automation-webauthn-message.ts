/**
 * A WebAuthn assertion request waiting in the automation WebAuthn client, with bytes as
 * base64url, since automation passes JSON. Mirrors `webauthn.AssertionRequest`.
 */
export interface AutomationWebAuthnRequest {
  id: string;
  origin: string;
  rpId: string;
  challenge: string;
  allowCredentials: { id: string; transports?: string[] }[];
  userVerification?: string;
  timeout?: number;
  prf?: { first: string; second?: string };
  appId?: string;
}

/**
 * The authenticator's answer to an {@link AutomationWebAuthnRequest}, with bytes as base64url.
 * Mirrors `webauthn.AssertionResponse`, so the client data is built by whoever answers.
 */
export interface AutomationWebAuthnResponse {
  credentialId: string;
  clientDataJson: string;
  authenticatorData: string;
  signature: string;
  userHandle?: string;
  authenticatorAttachment?: string;
  prf?: { first: string; second?: string };
  appIdUsed?: boolean;
}

/** A `DOMException` to fail a request with, e.g. `NotAllowedError` for a cancelled prompt. */
export interface AutomationWebAuthnError {
  name: string;
  message: string;
}

export const AutomationWebAuthnAction = Object.freeze({
  ListPending: "listPending",
  Respond: "respond",
  Reject: "reject",
} as const);
export type AutomationWebAuthnAction =
  (typeof AutomationWebAuthnAction)[keyof typeof AutomationWebAuthnAction];

export type AutomationWebAuthnMessage =
  | { action: typeof AutomationWebAuthnAction.ListPending }
  | {
      action: typeof AutomationWebAuthnAction.Respond;
      id: string;
      response: AutomationWebAuthnResponse;
    }
  | { action: typeof AutomationWebAuthnAction.Reject; id: string; error: AutomationWebAuthnError };

export const AUTOMATION_WEBAUTHN_CHANNEL = "automation.webauthn";

/** Main-to-renderer event carrying each request as it starts waiting. */
export const AUTOMATION_WEBAUTHN_REQUEST_CHANNEL = "automation.webauthn.request";
