import { ChildProcess, spawn } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";

import { runOrThrow } from "../process";

import { SshKey } from "./keys";

export const SSH_HOST = "127.0.0.1";

// sshd re-executes itself, so it must be started by absolute path. `E2E_SSHD` overrides.
const SSHD_PATHS = [
  "/usr/sbin/sshd",
  "/opt/homebrew/opt/openssh/sbin/sshd",
  "/usr/local/sbin/sshd",
];
const READY_LOG = "Server listening on";
const START_TIMEOUT_MS = 10_000;

function sshdPath(): string {
  const path = process.env.E2E_SSHD ?? SSHD_PATHS.find((candidate) => existsSync(candidate));
  if (path == null) {
    throw new Error(`No sshd in ${SSHD_PATHS.join(", ")}; install OpenSSH or set E2E_SSHD.`);
  }

  return path;
}

/** A port nothing listens on right now. */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(0, SSH_HOST, () => {
      const address = server.address();
      server.close(() => resolve(typeof address === "object" ? address!.port : 0));
    });
  });
}

/**
 * An OpenSSH server on loopback, run as the current user, so it only accepts logins as that
 * user. It accepts `authorizedKeys` and no passwords, and allows agent forwarding.
 */
export class SshServer {
  private constructor(
    readonly port: number,
    private readonly sshd: ChildProcess,
  ) {}

  /** Starts sshd with its host key and config in `dir`. */
  static async start(dir: string, authorizedKeys: SshKey[]): Promise<SshServer> {
    const hostKey = join(dir, "ssh_host_ed25519_key");
    await runOrThrow("ssh-keygen", ["-q", "-t", "ed25519", "-N", "", "-f", hostKey]);

    const authorizedKeysFile = join(dir, "authorized_keys");
    writeFileSync(authorizedKeysFile, authorizedKeys.map((key) => key.publicKey).join("\n") + "\n");

    // Unprivileged: no PAM, and no ownership checks on the temp dir.
    const config = join(dir, "sshd_config");
    writeFileSync(
      config,
      [
        `ListenAddress ${SSH_HOST}`,
        `HostKey ${hostKey}`,
        `AuthorizedKeysFile ${authorizedKeysFile}`,
        "PidFile none",
        "UsePAM no",
        "StrictModes no",
        "PasswordAuthentication no",
        "KbdInteractiveAuthentication no",
        "AllowAgentForwarding yes",
      ].join("\n") + "\n",
    );

    const port = await freePort();
    // -D: stay in the foreground; -e: log to stderr, where READY_LOG appears.
    const sshd = spawn(sshdPath(), ["-D", "-e", "-f", config, "-p", String(port)]);
    await SshServer.waitUntilListening(sshd);

    return new SshServer(port, sshd);
  }

  stop() {
    this.sshd.kill();
  }

  private static waitUntilListening(sshd: ChildProcess): Promise<void> {
    return new Promise((resolve, reject) => {
      let log = "";
      const timer = setTimeout(() => {
        sshd.kill();
        reject(new Error(`sshd did not start:\n${log}`));
      }, START_TIMEOUT_MS);

      sshd.stderr!.on("data", (chunk) => {
        log += chunk;
        if (log.includes(READY_LOG)) {
          clearTimeout(timer);
          resolve();
        }
      });
      sshd.on("exit", (code) => {
        clearTimeout(timer);
        reject(new Error(`sshd exited ${code}:\n${log}`));
      });
    });
  }
}
