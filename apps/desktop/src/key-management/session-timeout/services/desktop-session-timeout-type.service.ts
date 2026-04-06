import { SessionTimeoutTypeService } from "@bitwarden/common/key-management/session-timeout";
import {
  isVaultTimeoutTypeNumeric,
  VaultTimeout,
  VaultTimeoutNumberType,
  VaultTimeoutStringType,
} from "@bitwarden/common/key-management/vault-timeout";

export class DesktopSessionTimeoutTypeService implements SessionTimeoutTypeService {
  async isAvailable(type: VaultTimeout): Promise<boolean> {
    switch (type) {
      case VaultTimeoutNumberType.Immediately:
        return false;
      case VaultTimeoutStringType.OnIdle:
      case VaultTimeoutStringType.OnSleep:
      case VaultTimeoutStringType.OnRestart:
      case VaultTimeoutStringType.Never:
      case VaultTimeoutStringType.Custom:
        return true;
      case VaultTimeoutStringType.OnLocked:
        return await ipc.platform.powermonitor.isLockMonitorAvailable();
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
        case VaultTimeoutStringType.OnLocked:
          return VaultTimeoutStringType.OnSleep;
        default:
          return VaultTimeoutStringType.OnRestart;
      }
    }
    return type;
  }
}
