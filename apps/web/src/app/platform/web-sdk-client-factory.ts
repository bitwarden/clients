import { SdkClientFactory } from "@bitwarden/common/platform/abstractions/sdk/sdk-client-factory";
import * as sdk from "@bitwarden/sdk-internal";

/**
 * SDK client factory with a js fallback for when WASM is not supported.
 */
export class WebSdkClientFactory implements SdkClientFactory {
  async createSdkClient(
    ...args: ConstructorParameters<typeof sdk.BitwardenClient>
  ): Promise<sdk.BitwardenClient> {
    return Promise.resolve(new sdk.BitwardenClient(...args));
  }
}
