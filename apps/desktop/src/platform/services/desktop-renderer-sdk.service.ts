import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { DefaultSdkService } from "@bitwarden/common/platform/services/sdk/default-sdk.service";
import { UserId } from "@bitwarden/common/types/guid";
import { PasswordManagerClient } from "@bitwarden/sdk-internal";

/**
 * The renderer's {@link DefaultSdkService}. Main owns the session, but the renderer's
 * {@link DesktopRendererKeyService} keeps the default state bridge's view of the user key (read
 * from the same state the bridge always reads) synced to main's, instead of overriding the bridge
 * to fetch it over IPC on every read.
 *
 * It also disables the renderer client's own local unlock migrations: main's client runs them
 * instead, and the SDK does not support two clients racing the same migration.
 */
export class DesktopRendererSdkService extends DefaultSdkService {
  protected override async onClientCreated(
    userId: UserId,
    client: PasswordManagerClient,
  ): Promise<void> {
    if (await this.configServiceProvider().getFeatureFlag(FeatureFlag.DesktopRendererTeardown)) {
      client.crypto().disable_local_unlock_migrations();
    }
  }
}
