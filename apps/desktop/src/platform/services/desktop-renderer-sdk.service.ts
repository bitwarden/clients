import { DefaultSdkService } from "@bitwarden/common/platform/services/sdk/default-sdk.service";
import { UserId } from "@bitwarden/common/types/guid";
import { PasswordManagerClient } from "@bitwarden/sdk-internal";

import { rendererTeardownEnabled } from "../renderer-teardown-flag";

/**
 * Since the renderer's {@link DefaultSdkService} owns the unlock session and migration, we disable
 * them in the renderer sdk so that we don't have double migrations that could race with each other.
 */
export class DesktopRendererSdkService extends DefaultSdkService {
  protected override async onClientCreated(
    userId: UserId,
    client: PasswordManagerClient,
  ): Promise<void> {
    if (await rendererTeardownEnabled()) {
      client.crypto().disable_local_unlock_migrations();
    }
  }
}
