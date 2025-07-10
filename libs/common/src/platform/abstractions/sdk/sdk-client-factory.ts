import type { BitwardenClient } from "@bitwarden/sdk-internal";

/**
 * Factory for creating SDK clients.
 */
export abstract class SdkClientFactory {
  /**
   * Creates a new BitwardenClient. Assumes the SDK is already loaded.
   * @param args Bitwarden client constructor parameters
   */
  abstract createSdkClient(
    ...args: ConstructorParameters<typeof BitwardenClient>
  ): Promise<BitwardenClient>;
}
