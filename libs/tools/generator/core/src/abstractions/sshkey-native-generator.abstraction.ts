import { SshKeyData } from "@bitwarden/common/vault/models/data/ssh-key.data";

/**
 * Generates SSH keys using a native implementation.
 */
export abstract class SshKeyNativeGenerator {
  /**
   * @param keyAlgorithm The algorithm to use for key generation.
   * @param keyLength The length of the key to generate; only used for RSA keys.
   */
  generate: (keyAlgorithm: "rsa" | "ed25519", keyLength?: number) => Promise<SshKeyData>;
}
