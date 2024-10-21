import { SshKeyApi } from "@bitwarden/common/vault/models/api/ssh-key.api";
import { SshKeyData } from "@bitwarden/common/vault/models/data/ssh-key.data";

import { SshKeyNativeGenerator } from "../../../../../libs/tools/generator/core/src/abstractions/sshkey-native-generator.abstraction";

export class ElectronSshKeyGeneratorService implements SshKeyNativeGenerator {
  /**
   * Generate a new SSH key pair. This is done via IPC to the main process. The ssh key generation happens in the desktop_native module because it is implemented in Rust.
   * This can be later replaced by an SDK-wasm implementation.
   * @param keyAlgorithm The algorithm to use for the key generation. Currently only "rsa" and "ed25519" are supported.
   * @param keyLength The length of the key to generate in bits. Only used for RSA keys.
   * @returns The generated SSH key pair.
   */
  async generate(keyAlgorithm: "rsa" | "ed25519", keyLength?: number): Promise<SshKeyData> {
    let algorithmNameWithBits = keyAlgorithm;
    if (keyAlgorithm === "rsa") {
      algorithmNameWithBits += `${keyLength}`;
    }
    const key = await ipc.platform.sshAgent.generateKey(algorithmNameWithBits);
    return new SshKeyData(
      new SshKeyApi({
        privateKey: key.privateKey,
        publicKey: key.publicKey,
        keyFingerprint: key.keyFingerprint,
      }),
    );
  }
}
