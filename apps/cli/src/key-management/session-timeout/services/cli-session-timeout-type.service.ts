import { SessionTimeoutTypeService } from "@bitwarden/common/key-management/session-timeout";
import {
  VaultTimeout,
  VaultTimeoutStringType,
} from "@bitwarden/common/key-management/vault-timeout";

export class CliSessionTimeoutTypeService implements SessionTimeoutTypeService {
  async isAvailable(timeout: VaultTimeout): Promise<boolean> {
    return timeout === VaultTimeoutStringType.Never;
  }

  async getHighestAvailable(_: VaultTimeout): Promise<VaultTimeout> {
    return VaultTimeoutStringType.Never;
  }
}
