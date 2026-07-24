import { SessionTimeoutTypeService } from "@bitwarden/common/key-management/session-timeout";
import { VaultTimeout } from "@bitwarden/common/key-management/vault-timeout";

/**
 * Main-process `SessionTimeoutTypeService`.
 *
 * The renderer `DesktopSessionTimeoutTypeService` reads the `ipc.platform.powermonitor` preload
 * global (absent in main). This exists only to satisfy `DefaultVaultTimeoutSettingsService`, which
 * is a transitive dependency of the base `ApiService` used by the main SDK stack. It is not on the
 * vault read/decrypt path (token refresh is not exercised there), so a permissive implementation is
 * sufficient for the current scope.
 */
export class MainSessionTimeoutTypeService implements SessionTimeoutTypeService {
  async isAvailable(timeout: VaultTimeout): Promise<boolean> {
    return true;
  }

  async getOrPromoteToAvailable(timeout: VaultTimeout): Promise<VaultTimeout> {
    return timeout;
  }
}
