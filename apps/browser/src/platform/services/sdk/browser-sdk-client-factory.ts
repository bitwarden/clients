import { SdkClientFactory } from "@bitwarden/common/platform/abstractions/sdk/sdk-client-factory";
import * as sdk from "@bitwarden/sdk-internal";
import type { BitwardenClient } from "@bitwarden/sdk-internal";

/**
 * SDK client factory with a js fallback for when WASM is not supported.
 *
 * Works both in popup and service worker.
 */
export class BrowserSdkClientFactory implements SdkClientFactory {
  async createSdkClient(
    ...args: ConstructorParameters<typeof BitwardenClient>
  ): Promise<BitwardenClient> {
    const instance = new sdk.BitwardenClient(...args);

    return instance;
  }
}
