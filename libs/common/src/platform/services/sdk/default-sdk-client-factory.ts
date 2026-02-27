import * as sdk from "@bitwarden/sdk-internal";

import { SdkClientFactory } from "../../abstractions/sdk/sdk-client-factory";

/**
 * Default SDK client factory.
 */
export class DefaultSdkClientFactory implements SdkClientFactory {
  /**
   * Initializes a Password Manager client. Assumes the SDK is already loaded.
   * @param args Password Manager client constructor parameters
   * @returns A PasswordManagerClient
   */
  async createSdkClient(
    ...args: ConstructorParameters<typeof sdk.PasswordManagerClient>
  ): Promise<sdk.PasswordManagerClient> {
    return Promise.resolve(new sdk.PasswordManagerClient(...args));
  }
}
