import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

import { runOrThrow } from "./process";

/** Key types the SSH agent supports, as `ssh-keygen -t` names them. */
export const SshKeyType = Object.freeze({
  Ed25519: "ed25519",
  Ecdsa: "ecdsa",
  Rsa: "rsa",
} as const);
export type SshKeyType = (typeof SshKeyType)[keyof typeof SshKeyType];

// `ssh-keygen -b` per type; ED25519 has a single size.
const KEY_BITS: Record<SshKeyType, string[]> = {
  [SshKeyType.Ed25519]: [],
  [SshKeyType.Ecdsa]: ["-b", "256"],
  [SshKeyType.Rsa]: ["-b", "3072"],
};

/** A key pair for a vault's SSH key item. Only its public half is on disk. */
export type SshKey = {
  type: SshKeyType;
  /** The vault item's name, and the key's comment. */
  name: string;
  /** OpenSSH format. */
  privateKey: string;
  /** e.g. `ssh-ed25519 AAAA… name`. */
  publicKey: string;
  /** e.g. `SHA256:…`. */
  fingerprint: string;
  /** Selects the key from an agent, e.g. `ssh -o IdentityFile=<publicKeyPath>`. */
  publicKeyPath: string;
};

/**
 * Generates a key pair in `dir`. Deletes the private key file, so only the agent can sign
 * with it: an OpenSSH tool cannot fall back to the file.
 */
export async function generateKey(dir: string, type: SshKeyType): Promise<SshKey> {
  const name = `e2e-${type}`;
  const path = join(dir, name);
  const publicKeyPath = `${path}.pub`;

  await runOrThrow("ssh-keygen", [
    "-q",
    "-t",
    type,
    ...KEY_BITS[type],
    "-N",
    "",
    "-C",
    name,
    "-f",
    path,
  ]);

  // `ssh-keygen -l` prints e.g. `256 SHA256:abc… e2e-ed25519 (ED25519)`.
  const { stdout } = await runOrThrow("ssh-keygen", ["-l", "-E", "sha256", "-f", publicKeyPath]);
  const fingerprint = stdout.split(" ")[1];

  const privateKey = readFileSync(path, "utf8");
  rmSync(path);

  return {
    type,
    name,
    privateKey,
    publicKey: readFileSync(publicKeyPath, "utf8").trim(),
    fingerprint,
    publicKeyPath,
  };
}
