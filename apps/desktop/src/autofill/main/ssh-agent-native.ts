import { sshagent } from "@bitwarden/desktop-napi";

import { SshAgentSetupEnvironment } from "../models/ssh-agent-setup";

export type SshAgentStartErrorCode = NonNullable<SshAgentSetupEnvironment["startErrorCode"]>;

/** Native SSH agent calls used by the setup flow. */
export interface SshAgentNativeBridge {
  /** The address the agent binds (Unix socket path or Windows pipe name), or null if unknown. */
  getSocketAddress(): string | null;
  /** True when something accepts connections on the address. */
  probeAddress(address: string): Promise<boolean>;
}

/**
 * Maps a start failure from the native agent to a short error class. Only the class leaves this
 * function; the message (which can contain a path) is never returned or logged.
 */
export function classifySshAgentStartError(e: unknown): SshAgentStartErrorCode {
  const code =
    typeof e === "object" && e != null && "code" in e && typeof e.code === "string" ? e.code : "";
  const message = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  const text = `${code} ${message}`.toLowerCase();
  if (/address-in-use|addrinuse|address already in use|address in use/.test(text)) {
    return "address-in-use";
  }
  if (/permission-denied|permissiondenied|permission denied|eacces|eperm/.test(text)) {
    return "permission-denied";
  }
  return "unknown";
}

export function createSshAgentNativeBridge(): SshAgentNativeBridge {
  return {
    getSocketAddress: () => {
      try {
        const address = sshagent.getSocketAddress();
        return typeof address === "string" && address.length > 0 ? address : null;
      } catch {
        return null;
      }
    },
    probeAddress: async (address: string) => {
      try {
        return (await sshagent.probeAddress(address)) === true;
      } catch {
        return false;
      }
    },
  };
}
