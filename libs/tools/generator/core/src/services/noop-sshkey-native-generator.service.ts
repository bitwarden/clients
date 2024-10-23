import { SshKeyData } from "@bitwarden/common/vault/models/data/ssh-key.data";

import { SshKeyNativeGenerator } from "../abstractions/sshkey-native-generator.abstraction";

export class NoopSshKeyGeneratorService implements SshKeyNativeGenerator {
  async generate(_keyAlgorithm: "rsa" | "ed25519", _keyLength?: number) {
    return new SshKeyData();
  }
}
