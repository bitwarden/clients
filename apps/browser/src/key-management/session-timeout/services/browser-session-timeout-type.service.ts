import { SessionTimeoutTypeService } from "@bitwarden/common/key-management/session-timeout";
import {
  VaultTimeout,
  VaultTimeoutStringType,
} from "@bitwarden/common/key-management/vault-timeout";
import {
  isVaultTimeoutTypeNumeric,
  VaultTimeoutNumberType,
} from "@bitwarden/common/key-management/vault-timeout/types/vault-timeout.type";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

export class BrowserSessionTimeoutTypeService implements SessionTimeoutTypeService {
  constructor(private readonly platformUtilsService: PlatformUtilsService) {}

  async isAvailable(type: VaultTimeout): Promise<boolean> {
    switch (type) {
      case VaultTimeoutNumberType.Immediately:
      case VaultTimeoutStringType.OnRestart:
      case VaultTimeoutStringType.Never:
      case VaultTimeoutStringType.Custom:
        return true;
      case VaultTimeoutStringType.OnLocked:
        return (
          !this.platformUtilsService.isFirefox() &&
          !this.platformUtilsService.isSafari() &&
          !(this.platformUtilsService.isOpera() && navigator.platform === "MacIntel")
        );
      default:
        if (isVaultTimeoutTypeNumeric(type)) {
          return true;
        }
        break;
    }

    return false;
  }
}
