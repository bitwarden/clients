import { DefaultLockComponentService, LockComponentService } from "@bitwarden/auth/angular";
import { UserId } from "@bitwarden/common/types/guid";

export class DesktopLockComponentService
  extends DefaultLockComponentService
  implements LockComponentService
{
  constructor() {
    super();
  }

  override async isWindowVisible(): Promise<boolean> {
    return ipc.platform.isWindowVisible();
  }

  override async biometricsEnabled(userId: UserId): Promise<boolean> {
    return await ipc.platform.biometric.enabled(userId);
  }
}
