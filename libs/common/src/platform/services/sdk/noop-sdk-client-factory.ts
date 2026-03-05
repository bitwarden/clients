import type { PasswordManagerClient } from "@bitwarden/sdk-internal";

import { SdkClientFactory } from "../../abstractions/sdk/sdk-client-factory";

/**
 * Noop SDK client factory.
 *
 * Used during SDK rollout to prevent bundling the SDK with some applications.
 */
export class NoopSdkClientFactory implements SdkClientFactory {
  createSdkClient(
    ...args: ConstructorParameters<typeof PasswordManagerClient>
  ): Promise<PasswordManagerClient> {
    return Promise.reject(new Error("SDK not available"));
  }
}
