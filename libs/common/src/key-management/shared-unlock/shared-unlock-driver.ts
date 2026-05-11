import { firstValueFrom } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { LockService } from "@bitwarden/auth/common";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { UserId as TSUserId } from "@bitwarden/common/types/guid";
// eslint-disable-next-line no-restricted-imports
import { KeyService } from "@bitwarden/key-management";
import { UserId, SharedUnlockDriver, SymmetricKey } from "@bitwarden/sdk-internal";

import { AccountService } from "../../auth/abstractions/account.service";
import { EnvironmentService } from "../../platform/abstractions/environment.service";
import { asUuid, uuidAsString } from "../../platform/abstractions/sdk/sdk.service";
import { SymmetricCryptoKey } from "../../platform/models/domain/symmetric-crypto-key";
import { UserKey } from "../../types/key";
import { VaultTimeoutSettingsService } from "../vault-timeout/abstractions/vault-timeout-settings.service";

import { SharedUnlockSettingsService } from "./shared-unlock-settings.service";

function fromSdkUserId(userId: UserId): TSUserId {
  return uuidAsString(userId) as TSUserId;
}

export function createSharedUnlockDriver(
  accountService: AccountService,
  lockService: LockService,
  keyService: KeyService,
  platformUtilsService: PlatformUtilsService,
  vaultTimeoutSettingsService: VaultTimeoutSettingsService,
  environmentService: EnvironmentService,
  sharedUnlockSettingsService: SharedUnlockSettingsService,
): SharedUnlockDriver {
  return {
    async lock_user(user_id: UserId): Promise<void> {
      if (
        !(await sharedUnlockSettingsService.allowSharingUnlockState(fromSdkUserId(user_id)))
      ) {
        return;
      }

      await lockService.lock(fromSdkUserId(user_id));
    },
    async unlock_user(user_id: UserId, user_key: SymmetricKey): Promise<void> {
      if (
        !(await sharedUnlockSettingsService.allowSharingUnlockState(fromSdkUserId(user_id)))
      ) {
        return;
      }

      await keyService.setUserKey(
        SymmetricCryptoKey.fromSdk(user_key) as UserKey,
        fromSdkUserId(user_id),
      );
    },
    async get_user_key(user_id: UserId): Promise<SymmetricKey | undefined> {
      const typedUserId = fromSdkUserId(user_id);
      return (await firstValueFrom(keyService.userKey$(typedUserId)))?.toSdk();
    },
    async list_users(): Promise<UserId[]> {
      const accounts = await firstValueFrom(accountService.accounts$);
      return Object.keys(accounts).map(asUuid<UserId>);
    },
    async suppress_vault_timeout(user_id: UserId, suppression_duration_milliseconds: number): Promise<void> {
      const until = Date.now() + suppression_duration_milliseconds;
      await vaultTimeoutSettingsService.suppressVaultTimeout(
        until,
        fromSdkUserId(user_id),
      );
    },
    async get_client_name(): Promise<string> {
      return platformUtilsService.getClientType();
    },
    async get_vault_url(user_id: UserId): Promise<string> {
      const environment = await firstValueFrom(
        environmentService.getEnvironment$(fromSdkUserId(user_id)),
      );
      return environment.getWebVaultUrl();
    },
  };
}
