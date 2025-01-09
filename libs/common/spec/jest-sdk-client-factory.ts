import { ClientSettings, LogLevel, BitwardenClient } from "@bitwarden/sdk-internal";

import { SdkClientFactory } from "../src/platform/abstractions/sdk/sdk-client-factory";

export class DefaultSdkClientFactory implements SdkClientFactory {
  createSdkClient(settings?: ClientSettings, log_level?: LogLevel): Promise<BitwardenClient> {
    throw new Error("Method not implemented.");
  }
}
