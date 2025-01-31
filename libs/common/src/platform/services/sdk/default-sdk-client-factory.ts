import * as sdk from "@bitwarden/sdk-internal";

import { SdkClientFactory } from "../../abstractions/sdk/sdk-client-factory";

/**
 * Default SDK client factory.
 */
export class DefaultSdkClientFactory implements SdkClientFactory {
  /**
   * Initializes a Bitwarden client. Assumes the SDK is already loaded.
   * @param args Bitwarden client constructor parameters
   * @returns A BitwardenClient
   */
  async createSdkClient(
    ...args: ConstructorParameters<typeof sdk.BitwardenClient>
  ): Promise<sdk.BitwardenClient> {
    return Promise.resolve(new sdk.BitwardenClient(...args));
  }
}
