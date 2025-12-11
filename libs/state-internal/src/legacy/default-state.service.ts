import { firstValueFrom } from "rxjs";

import { RequiredUserId, StateService } from "@bitwarden/state";
import { StorageService } from "@bitwarden/storage-core";
import { UserId } from "@bitwarden/user-core";

import { ActiveUserAccessor } from "../active-user.accessor";

import { GlobalState } from "./global-state";

const keys = {
  global: "global",
};

const partialKeys = {
  userAutoKey: "_user_auto",
  userBiometricKey: "_user_biometric",
};

const DDG_SHARED_KEY = "DuckDuckGoSharedKey";

export class DefaultStateService implements StateService {
  constructor(
    private readonly storageService: StorageService,
    private readonly secureStorageService: StorageService,
    private readonly activeUserAccessor: ActiveUserAccessor,
  ) {}

  async clean(options: RequiredUserId): Promise<void> {
    await this.setUserKeyAutoUnlock(null, options);
    await this.clearUserKeyBiometric(options.userId);
  }

  /**
   * user key when using the "never" option of vault timeout
   */
  async getUserKeyAutoUnlock(options: RequiredUserId): Promise<string | null> {
    if (options.userId == null) {
      return null;
    }
    return await this.secureStorageService.get<string>(
      `${options.userId}${partialKeys.userAutoKey}`,
      {
        userId: options.userId,
        keySuffix: "auto",
      },
    );
  }

  /**
   * user key when using the "never" option of vault timeout
   */
  async setUserKeyAutoUnlock(value: string | null, options: RequiredUserId): Promise<void> {
    if (options.userId == null) {
      return;
    }
    await this.saveSecureStorageKey(partialKeys.userAutoKey, value, options.userId, "auto");
  }

  private async clearUserKeyBiometric(userId: UserId): Promise<void> {
    if (userId == null) {
      return;
    }
    await this.saveSecureStorageKey(partialKeys.userBiometricKey, null, userId, "biometric");
  }

  async getDuckDuckGoSharedKey(): Promise<string | null> {
    const userId = await this.getActiveUserIdFromStorage();
    if (userId == null) {
      return null;
    }
    return await this.secureStorageService.get<string>(DDG_SHARED_KEY);
  }

  async setDuckDuckGoSharedKey(value: string): Promise<void> {
    const userId = await this.getActiveUserIdFromStorage();
    if (userId == null) {
      return;
    }
    value == null
      ? await this.secureStorageService.remove(DDG_SHARED_KEY)
      : await this.secureStorageService.save(DDG_SHARED_KEY, value);
  }

  async setEnableDuckDuckGoBrowserIntegration(value: boolean): Promise<void> {
    const globals = (await this.storageService.get<GlobalState>(keys.global)) ?? new GlobalState();
    globals.enableDuckDuckGoBrowserIntegration = value;
    await this.storageService.save(keys.global, globals);
  }

  private async getActiveUserIdFromStorage(): Promise<UserId | null> {
    return await firstValueFrom(this.activeUserAccessor.activeUserId$);
  }

  private async saveSecureStorageKey(
    key: string,
    value: string | null,
    userId: UserId,
    keySuffix: string,
  ) {
    return value == null
      ? await this.secureStorageService.remove(`${userId}${key}`, { keySuffix: keySuffix })
      : await this.secureStorageService.save(`${userId}${key}`, value, {
          keySuffix: keySuffix,
        });
  }
}
