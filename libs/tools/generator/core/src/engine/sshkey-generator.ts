import { GenerationRequest } from "@bitwarden/common/tools/types";

import { SshKeyNativeGenerator } from "../abstractions/sshkey-native-generator.abstraction";
import { CredentialGenerator, GeneratedCredential, SshKeyAlgorithm } from "../types";
import {
  Ed25519KeyGenrationOptions,
  RsaSshKeyGenerationOptions,
} from "../types/sshkey-generation-options";

export class SshKeyGenerator
  implements CredentialGenerator<RsaSshKeyGenerationOptions | Ed25519KeyGenrationOptions>
{
  constructor(private sshkeyNativeGenerator: SshKeyNativeGenerator) {}

  async generate(
    request: GenerationRequest,
    settings: RsaSshKeyGenerationOptions | Ed25519KeyGenrationOptions,
  ): Promise<GeneratedCredential> {
    const key = (
      await this.sshkeyNativeGenerator.generate(request.algorithm as SshKeyAlgorithm, settings.bits)
    ).privateKey;
    return new GeneratedCredential(key, request.algorithm as SshKeyAlgorithm, Date.now());
  }
}
