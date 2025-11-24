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

export class WebSessionTimeoutTypeService implements SessionTimeoutTypeService {
  constructor(private readonly platformUtilsService: PlatformUtilsService) {}

  async isAvailable(type: VaultTimeout): Promise<boolean> {
    switch (type) {
      case VaultTimeoutNumberType.Immediately:
        return false;
      case VaultTimeoutStringType.OnRestart:
      case VaultTimeoutStringType.Custom:
        return true;
      case VaultTimeoutStringType.Never:
        return this.platformUtilsService.isDev();
      default:
        if (isVaultTimeoutTypeNumeric(type)) {
          return true;
        }
        break;
    }

    return false;
  }

  async getOrPromoteToAvailable(type: VaultTimeout): Promise<VaultTimeout> {
    const available = await this.isAvailable(type);
    if (!available) {
      switch (type) {
        case VaultTimeoutNumberType.Immediately:
          return VaultTimeoutNumberType.OnMinute;
        default:
          return VaultTimeoutStringType.OnRestart;
      }
    }
    return type;
  }
}
