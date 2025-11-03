import { SessionTimeoutTypeService } from "@bitwarden/common/key-management/session-timeout";
import {
  VaultTimeout,
  VaultTimeoutStringType,
} from "@bitwarden/common/key-management/vault-timeout";
import {
  isVaultTimeoutTypeNumeric,
  VaultTimeoutNumberType,
} from "@bitwarden/common/key-management/vault-timeout/types/vault-timeout.type";

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
        return ipc.platform.powermonitor.isLockMonitorAvailable();
      default:
        if (isVaultTimeoutTypeNumeric(type)) {
          return true;
        }
        break;
    }

    return false;
  }
}
