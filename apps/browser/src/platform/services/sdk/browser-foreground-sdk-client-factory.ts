import { SdkClientFactory } from "@bitwarden/common/platform/abstractions/sdk/sdk-client-factory";
import type { PasswordManagerClient } from "@bitwarden/sdk-internal";

/**
 * SDK client factory for the extension's foreground: popup, sidebar and extension pages.
 *
 * Each open popup unlocks along with the background. Concurrent local unlock migrations, such as
 * the PIN migration, race on the same state, so they are left to the background.
 */
export class BrowserForegroundSdkClientFactory implements SdkClientFactory {
  constructor(private readonly inner: SdkClientFactory) {}

  async createSdkClient(
    ...args: ConstructorParameters<typeof PasswordManagerClient>
  ): Promise<PasswordManagerClient> {
    const client = await this.inner.createSdkClient(...args);
    client.crypto().disable_local_unlock_migrations();
    return client;
  }
}
