import { PasswordManagerClient } from "@bitwarden/sdk-internal";

import { SdkClientFactory } from "../src/platform/abstractions/sdk/sdk-client-factory";

export class DefaultSdkClientFactory implements SdkClientFactory {
  createSdkClient(
    ...args: ConstructorParameters<typeof PasswordManagerClient>
  ): Promise<PasswordManagerClient> {
    throw new Error("Method not implemented.");
  }
}
