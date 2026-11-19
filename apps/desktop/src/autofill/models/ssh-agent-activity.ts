/** An agent operation a client requested. */
export const SshAgentActivityOperation = Object.freeze({
  /** Listed the agent's public keys, e.g. `ssh-add -L`. */
  List: "list",
  /** Signed with a key, e.g. to log in to a server or sign a git commit. */
  Sign: "sign",
} as const);
export type SshAgentActivityOperation =
  (typeof SshAgentActivityOperation)[keyof typeof SshAgentActivityOperation];

/** How the agent answered an operation. */
export const SshAgentActivityOutcome = Object.freeze({
  Allowed: "allowed",
  Denied: "denied",
  /** No decision was made, e.g. the key was missing or approval timed out. */
  Failed: "failed",
} as const);
export type SshAgentActivityOutcome =
  (typeof SshAgentActivityOutcome)[keyof typeof SshAgentActivityOutcome];

/** One answered SSH agent operation and the process that requested it. */
export interface SshAgentActivity {
  /** When the agent answered, in milliseconds since the epoch. */
  timestamp: number;
  operation: SshAgentActivityOperation;
  outcome: SshAgentActivityOutcome;
  cipherId?: string;
  /** The SSHSIG namespace, e.g. `git`. Absent when logging in to a server. */
  namespace?: string;
  processName?: string;
  /** The requesting process's command line, e.g. `ssh -t example.com`. */
  command?: string;
  /** The nearest app above the requesting process, e.g. `claude`. */
  callerApp?: string;
  /** The outermost app above the requesting process, e.g. `iTerm2`. */
  hostApp?: string;
  /** The nearest AI agent above the requesting process, e.g. `claude`. */
  aiAgent?: string;
  /** The server an `ssh` process logs in to, e.g. `git@github.com`. */
  destination?: string;
  isForwarding: boolean;
}
