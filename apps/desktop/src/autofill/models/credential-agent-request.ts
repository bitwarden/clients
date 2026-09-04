/** The outcome of a credential request. Mirrors the Rust agent's response statuses. */
export const CredentialRequestStatus = Object.freeze({
  Granted: "granted",
  Denied: "denied",
  NotFound: "notFound",
} as const);

export type CredentialRequestStatus =
  (typeof CredentialRequestStatus)[keyof typeof CredentialRequestStatus];

/** A credential request forwarded from the agent to the renderer for approval and lookup. */
export interface CredentialAgentRequest {
  requestId: number;
  uri?: string;
  name?: string;
  /** The process that connected to the agent, when the OS could identify it. */
  processName?: string;
}

/** The credential handed back to the requesting client. */
export interface CredentialAgentCredential {
  cipherId: string;
  name: string;
  username?: string;
  password?: string;
  totp?: string;
}

/** The renderer's answer to a {@link CredentialAgentRequest}. */
export interface CredentialAgentResponse {
  requestId: number;
  status: CredentialRequestStatus;
  /** Set only when `status` is `Granted`. */
  credential?: CredentialAgentCredential;
}
