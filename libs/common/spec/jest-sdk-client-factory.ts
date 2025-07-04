import { BitwardenClient } from "@bitwarden/sdk-internal";

import { SdkClientFactory } from "../src/platform/abstractions/sdk/sdk-client-factory";

export class DefaultSdkClientFactory implements SdkClientFactory {
  createSdkClient(
    ...args: ConstructorParameters<typeof BitwardenClient>
  ): Promise<BitwardenClient> {
    throw new Error("Method not implemented.");
  }
}
