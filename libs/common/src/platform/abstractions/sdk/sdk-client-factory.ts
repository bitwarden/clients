import type { BitwardenClient } from "@bitwarden/sdk-internal";

/**
 * Factory for creating SDK clients.
 */
export abstract class SdkClientFactory {
  abstract createSdkClient(
    ...args: ConstructorParameters<typeof BitwardenClient>
  ): Promise<BitwardenClient>;
}
