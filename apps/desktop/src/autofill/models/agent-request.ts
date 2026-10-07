/** Mirrors napi `agent_access`; the renderer can't import napi. */

export const AgentOutcomeStatus = Object.freeze({
  Approved: "approved",
  Denied: "denied",
  NotFound: "notFound",
  Locked: "locked",
  Timeout: "timeout",
  Error: "error",
} as const);
export type AgentOutcomeStatus = (typeof AgentOutcomeStatus)[keyof typeof AgentOutcomeStatus];

export type AgentSigner = {
  kind: "developerId" | "platform" | "adHoc" | "other";
  id?: string;
  organization?: string;
  valid: boolean;
};

export type AgentProcess = { pid: number; name: string; exe?: string; signer?: AgentSigner };

/** Set by the OS-facing listener, never by the client. `chain` runs from the socket peer up. */
export type AgentRequester = {
  app: AgentProcess;
  chain: AgentProcess[];
  /** The peer is the `bw-access` shipped with this app, so its `purpose` holds. */
  bundledCli: boolean;
};

/** Only an Apple-anchored signature names who signed; ad hoc and self-signed ones prove nothing. */
export function verifiedSigner(signer?: AgentSigner): AgentSigner | undefined {
  return signer?.valid && (signer.kind === "developerId" || signer.kind === "platform")
    ? signer
    : undefined;
}

export type AgentCredentialQuery = { domain?: string; id?: string; search?: string };

/** Client-reported; display only. `env` maps a variable name to a credential field. */
export type AgentPurpose = { command?: string; env: Record<string, string> };

/** From the SSH agent; its requester carries only a process name. */
export type AgentSshSign = {
  type: "sshSign";
  cipherId: string;
  /** SSHSIG namespace; absent for an SSH login. */
  namespace?: string;
  isForwarding: boolean;
  hostFingerprint?: string;
};

export type AgentRequestKind =
  | { type: "credential"; query: AgentCredentialQuery; purpose?: AgentPurpose }
  | { type: "approval"; title: string; body?: string }
  | AgentSshSign;

export type AgentRequest<K extends AgentRequestKind = AgentRequestKind> = {
  /** Main's broker id. */
  requestId: number;
  kind: K;
  requester: AgentRequester;
  /** Epoch ms after which nobody waits for the answer. */
  deadline: number;
};

export type AgentCredentialField = "username" | "password" | "totp";

export type AgentCredential = {
  username?: string;
  password?: string;
  totp?: string;
  uri?: string;
  credentialId?: string;
};

export type AgentOutcome = { status: AgentOutcomeStatus; credential?: AgentCredential };
