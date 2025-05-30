import { Injectable } from "@angular/core";

import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { SyncedUnlockService } from "@bitwarden/common/key-management/synced-unlock/abstractions/synced-unlock.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import { SyncedUnlockStateCommands } from "@bitwarden/key-management";

import { BrowserApi } from "../../platform/browser/browser-api";

@Injectable()
export class ForegroundSyncedUnlockService extends SyncedUnlockService {
  constructor(private logService: LogService) {
    super();
  }

  async isConnected(): Promise<boolean> {
    const response = await BrowserApi.sendMessageWithResponse<{
      result: boolean;
      error: string;
    }>(SyncedUnlockStateCommands.IsConnected);
    if (response.result == null) {
      throw response.error;
    }
    return response.result;
  }

  async lock(userId: UserId): Promise<void> {
    try {
      await BrowserApi.sendMessageWithResponse<{
        result: boolean;
        error: string;
      }>(SyncedUnlockStateCommands.SendLockToDesktop, { userId });
    } catch (e) {
      this.logService.error("Failed to send lock to desktop", e);
      throw e;
    }
  }

  async getUserStatusFromDesktop(userId: UserId): Promise<AuthenticationStatus> {
    const response = await BrowserApi.sendMessageWithResponse<{
      result: AuthenticationStatus;
      error: string;
    }>(SyncedUnlockStateCommands.GetUserStatusFromDesktop, { userId });
    if (response.result == null) {
      throw response.error;
    }
    return response.result;
  }

  async getUserKeyFromDesktop(userId: UserId): Promise<UserKey | null> {
    const response = await BrowserApi.sendMessageWithResponse<{
      result: UserKey;
      error: string;
    }>(SyncedUnlockStateCommands.GetUserKeyFromDesktop, { userId });
    if (response.result == null) {
      return null;
    }
    return response.result;
  }

  async focusDesktopApp(): Promise<void> {
    const response = await BrowserApi.sendMessageWithResponse<{
      result: boolean;
      error: string;
    }>(SyncedUnlockStateCommands.FocusDesktopApp);
    if (response.result == null) {
      throw response.error;
    }
  }

  async isConnectionTrusted(): Promise<boolean> {
    const response = await BrowserApi.sendMessageWithResponse<{
      result: boolean;
      error: string;
    }>(SyncedUnlockStateCommands.IsConnectionTrusted);
    if (response.result == null) {
      throw response.error;
    }
    return response.result;
  }
}
