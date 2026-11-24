import { SdkRandomNumberClient } from "@bitwarden/sdk-internal";

import { SdkLoadService } from "../../../platform/abstractions/sdk/sdk-load.service";
import { Utils } from "../../../platform/misc/utils";
import { AgentAccessPskGenerator } from "../abstractions/agent-access-psk-generator.abstraction";

/**
 * Produces an agent-access pre-shared key (PSK) via the WASM SDK. It generates 32 random bytes with
 * {@link SdkRandomNumberClient} and returns them as a base64 string.
 *
 * Readiness is awaited via the static {@link SdkLoadService.Ready} promise, mirroring the
 * `PureCrypto` usage in the key-rotation service; no new encryption logic is added here.
 */
export class DefaultAgentAccessPskGenerator implements AgentAccessPskGenerator {
  async generate(): Promise<string> {
    await SdkLoadService.Ready;
    return Utils.fromBufferToB64(new SdkRandomNumberClient().gen_bytes(32));
  }
}
