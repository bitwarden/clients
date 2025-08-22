import { firstValueFrom } from "rxjs";

import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { HashPurpose } from "@bitwarden/common/platform/enums";
import { UserKey } from "@bitwarden/common/types/key";
// eslint-disable-next-line no-restricted-imports
import { KdfConfig, KeyService } from "@bitwarden/key-management";

import { MasterPasswordUnlockService } from "../abstractions/master-password-unlock.service.abstraction";

export class DefaultMasterPasswordUnlockService implements MasterPasswordUnlockService {
  constructor(
    private readonly masterPasswordService: InternalMasterPasswordServiceAbstraction,
    private readonly keyService: KeyService,
  ) {}

  async unlockWithMasterPassword(masterPassword: string, activeAccount: Account): Promise<UserKey> {
    this.validateInput(masterPassword, activeAccount);

    const masterPasswordUnlockData = await firstValueFrom(
      this.masterPasswordService.masterPasswordUnlockData$(activeAccount.id),
    );

    if (masterPasswordUnlockData == null) {
      throw new Error(
        "Master password unlock data was not found in state for the user " + activeAccount.id,
      );
    }

    const userKey = await this.masterPasswordService.unwrapUserKeyFromMasterPasswordUnlockData(
      masterPassword,
      masterPasswordUnlockData,
    );

    if (userKey == null) {
      throw new Error("User key couldn't be decrypted");
    }

    await this.setLegacyState(masterPassword, activeAccount, masterPasswordUnlockData.kdf);

    return userKey;
  }

  private validateInput(masterPassword: string, activeAccount: Account): void {
    if (!masterPassword) {
      throw new Error("Master password is required");
    }
    if (!activeAccount) {
      throw new Error("Active account is required");
    }
  }

  // Previously unlocking had the side effect of setting the masterKey and masterPasswordHash in state.
  // This is to preserve that behavior, once masterKey and masterPasswordHash state is removed this should be removed as well.
  private async setLegacyState(
    masterPassword: string,
    activeAccount: Account,
    kdfConfig: KdfConfig,
  ): Promise<void> {
    const masterKey = await this.keyService.makeMasterKey(
      masterPassword,
      activeAccount.email,
      kdfConfig,
    );

    if (!masterKey) {
      throw new Error("Master key could not be created to set legacy master password state.");
    }

    const localKeyHash = await this.keyService.hashMasterKey(
      masterPassword,
      masterKey,
      HashPurpose.LocalAuthorization,
    );

    await this.masterPasswordService.setMasterKeyHash(localKeyHash, activeAccount.id);
    await this.masterPasswordService.setMasterKey(masterKey, activeAccount.id);
  }
}
