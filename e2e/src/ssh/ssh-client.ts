import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { ProcessResult, run } from "../process";

import { SshKey } from "./keys";
import { SSH_HOST, SshServer } from "./ssh-server";

// The namespace `ssh-keygen -Y` signs files in; the agent reports it to the app.
const FILE_NAMESPACE = "file";
const SIGNER = "e2e@example.com";

/** `ssh-add -L`: the public keys the agent on `agentSocket` offers. */
export async function listAgentKeys(agentSocket: string): Promise<ProcessResult> {
  return run("ssh-add", ["-L"], { env: { SSH_AUTH_SOCK: agentSocket } });
}

/**
 * OpenSSH's client tools, pointed at one agent socket and one server. They read no user
 * config, keys or known hosts, so only the agent can authenticate.
 *
 *   ssh ──agent socket──▶ desktop SSH agent ──approval──▶ app window
 *    │
 *    └──TCP──▶ sshd (SshServer) ──forwarded agent──▶ ssh (second hop)
 */
export class SshClient {
  private readonly knownHosts: string;

  constructor(
    private readonly dir: string,
    private readonly agentSocket: string,
    private readonly server: SshServer,
  ) {
    this.knownHosts = join(dir, "known_hosts");
  }

  /** Logs in to the server with `key` from the agent, and logs out. */
  async login(key: SshKey): Promise<ProcessResult> {
    return run("ssh", [
      ...this.options(key),
      "-o",
      `IdentityAgent=${this.agentSocket}`,
      SSH_HOST,
      "true",
    ]);
  }

  /**
   * Logs in with agent forwarding, then from that session logs in again through the forwarded
   * agent. The agent sees the second sign request as forwarded.
   */
  async loginForwarded(key: SshKey): Promise<ProcessResult> {
    // The second hop runs on the server, in the user's login shell, against $SSH_AUTH_SOCK.
    const secondHop = ["ssh", ...this.options(key), SSH_HOST, "true"].join(" ");

    return run("ssh", [
      ...this.options(key),
      "-o",
      `IdentityAgent=${this.agentSocket}`,
      "-o",
      "ForwardAgent=yes",
      SSH_HOST,
      secondHop,
    ]);
  }

  /** `ssh-keygen -Y sign` with `key` from the agent; writes `<file>.sig`. */
  async signFile(key: SshKey, file: string): Promise<ProcessResult> {
    return run("ssh-keygen", ["-Y", "sign", "-f", key.publicKeyPath, "-n", FILE_NAMESPACE, file], {
      env: { SSH_AUTH_SOCK: this.agentSocket },
    });
  }

  /** `ssh-keygen -Y verify`: checks `<file>.sig` is `key`'s signature over `file`. */
  async verifyFile(key: SshKey, file: string, contents: string): Promise<ProcessResult> {
    const allowedSigners = join(this.dir, `allowed_signers_${key.type}`);
    writeFileSync(allowedSigners, `${SIGNER} ${key.publicKey}\n`);

    return run(
      "ssh-keygen",
      [
        "-Y",
        "verify",
        "-f",
        allowedSigners,
        "-I",
        SIGNER,
        "-n",
        FILE_NAMESPACE,
        "-s",
        `${file}.sig`,
      ],
      { input: contents },
    );
  }

  private options(key: SshKey): string[] {
    return [
      "-F",
      "/dev/null",
      "-p",
      String(this.server.port),
      "-o",
      `IdentityFile=${key.publicKeyPath}`,
      "-o",
      "IdentitiesOnly=yes",
      "-o",
      `UserKnownHostsFile=${this.knownHosts}`,
      "-o",
      "StrictHostKeyChecking=accept-new",
      "-o",
      "BatchMode=yes",
    ];
  }
}
