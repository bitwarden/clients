// eslint-disable-next-line no-restricted-imports
import { KeyGenerationService } from "@bitwarden/legacy-crypto";

import { Utils } from "../../../platform/misc/utils";
import { AgentAccessPskGenerator } from "../abstractions/agent-access-psk-generator.abstraction";

/**
 * Temporary stub PSK generator. It produces a random 256-bit CSPRNG value (base64) using the
 * existing {@link KeyGenerationService} — it does NOT add new encryption logic. The real
 * agent-access library will replace this implementation; until then it lets the OAuth broker flow
 * run end-to-end.
 */
export class DefaultAgentAccessPskGenerator implements AgentAccessPskGenerator {
  private readonly pskPurpose = "agent-access-psk";
  private readonly pskSalt = "bitwarden-agent-access";

  constructor(private keyGenerationService: KeyGenerationService) {}

  async generate(): Promise<string> {
    const key = await this.keyGenerationService.createKeyWithPurpose(
      256,
      this.pskPurpose,
      this.pskSalt,
    );
    return Utils.fromBufferToB64(key.material);
  }
}
