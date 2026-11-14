import { writeFileSync } from "node:fs";
import { join } from "node:path";

/** Key types the SSH agent supports. */
export const SshKeyType = Object.freeze({
  Ed25519: "ed25519",
  Ecdsa: "ecdsa",
  Rsa: "rsa",
} as const);
export type SshKeyType = (typeof SshKeyType)[keyof typeof SshKeyType];

// The key's algorithm, as the first field of a public key line names it.
const ALGORITHM_PREFIXES: Record<SshKeyType, string> = {
  [SshKeyType.Ed25519]: "ssh-ed25519",
  [SshKeyType.Ecdsa]: "ecdsa-sha2-",
  [SshKeyType.Rsa]: "ssh-rsa",
};

/** A vault SSH key, as the agent offers it. Its private half never leaves the agent. */
export type SshKey = {
  type: SshKeyType;
  /** The vault item's name, which the agent offers as the key's comment. */
  name: string;
  /** e.g. `ssh-ed25519 AAAA… name`. */
  publicKey: string;
  /** Selects the key from an agent, e.g. `ssh -o IdentityFile=<publicKeyPath>`. */
  publicKeyPath: string;
};

/**
 * The first key of each type in `ssh-add -L` output, e.g.
 * `ssh-ed25519 AAAAC3Nz… My SSH key`. Writes each public key to `dir`, so OpenSSH tools can
 * pin it.
 */
export function keysByType(listed: string, dir: string): Map<SshKeyType, SshKey> {
  const keys = new Map<SshKeyType, SshKey>();

  for (const line of listed.split("\n")) {
    const [algorithm, , ...comment] = line.trim().split(" ");
    const type = Object.values(SshKeyType).find((t) => algorithm.startsWith(ALGORITHM_PREFIXES[t]));
    if (type == null || keys.has(type)) {
      continue;
    }

    const publicKey = line.trim();
    const publicKeyPath = join(dir, `${type}.pub`);
    writeFileSync(publicKeyPath, `${publicKey}\n`);

    keys.set(type, { type, name: comment.join(" "), publicKey, publicKeyPath });
  }

  return keys;
}
