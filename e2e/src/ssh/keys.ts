import { writeFileSync } from "node:fs";
import { join } from "node:path";

/** Key types the SSH agent supports. */
export const SshKeyType = Object.freeze({
  Ed25519: "ed25519",
  Ecdsa: "ecdsa",
  Rsa: "rsa",
} as const);
export type SshKeyType = (typeof SshKeyType)[keyof typeof SshKeyType];

// Maps the public key enum to the SSH public-key naming.
const ALGORITHM_PREFIXES: Record<SshKeyType, string> = {
  [SshKeyType.Ed25519]: "ssh-ed25519",
  [SshKeyType.Ecdsa]: "ecdsa-sha2-",
  [SshKeyType.Rsa]: "ssh-rsa",
};

export type SshKey = {
  type: SshKeyType;
  /** The vault item's name, which the agent offers as the key's comment. */
  name: string;
  /** e.g. `ssh-ed25519 AAAA... mykey`. */
  publicKey: string;
  /** Selects the key from an agent, e.g. `ssh -o IdentityFile=<publicKeyPath>`. */
  publicKeyPath: string;
};

/**
 * Maps the ssh keys that are loaded in the agent to a map of key-type to key. The test account
 * should have exactly one key per key-type.
 */
export function prepareKeys(listed: string, dir: string): Map<SshKeyType, SshKey> {
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
