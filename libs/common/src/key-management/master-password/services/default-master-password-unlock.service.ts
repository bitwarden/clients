import { firstValueFrom } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { KeyService } from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";
import { UserId } from "@bitwarden/user-core";

import { HashPurpose } from "../../../platform/enums";
import { UserKey } from "../../../types/key";
import { MasterPasswordUnlockService } from "../abstractions/master-password-unlock.service";
import { InternalMasterPasswordServiceAbstraction } from "../abstractions/master-password.service.abstraction";
import { MasterPasswordUnlockData } from "../types/master-password.types";

export class DefaultMasterPasswordUnlockService implements MasterPasswordUnlockService {
  constructor(
    private readonly masterPasswordService: InternalMasterPasswordServiceAbstraction,
    private readonly keyService: KeyService,
    private readonly logService: LogService,
  ) {}

  async unlockWithMasterPassword(masterPassword: string, userId: UserId): Promise<UserKey> {
    this.validateInput(masterPassword, userId);

    const masterPasswordUnlockData = await firstValueFrom(
      this.masterPasswordService.masterPasswordUnlockData$(userId),
    );

    if (masterPasswordUnlockData == null) {
      throw new Error("Master password unlock data was not found for the user " + userId);
    }

    const userKey = await this.masterPasswordService.unwrapUserKeyFromMasterPasswordUnlockData(
      masterPassword,
      masterPasswordUnlockData,
    );

    await this.setLegacyState(masterPassword, masterPasswordUnlockData, userId);

    return userKey;
  }

  async proofOfDecryption(masterPassword: string, userId: UserId): Promise<boolean> {
    this.validateInput(masterPassword, userId);

    try {
      const masterPasswordUnlockData = await firstValueFrom(
        this.masterPasswordService.masterPasswordUnlockData$(userId),
      );

      if (masterPasswordUnlockData == null) {
        this.logService.warning(
          `[DefaultMasterPasswordUnlockService] No master password unlock data found for user ${userId} returning false.`,
        );
        return false;
      }

      const userKey = await this.masterPasswordService.unwrapUserKeyFromMasterPasswordUnlockData(
        masterPassword,
        masterPasswordUnlockData,
      );

      return userKey != null;
    } catch (error) {
      // masterPasswordService.unwrapUserKeyFromMasterPasswordUnlockData is expected to throw if the password is incorrect.
      this.logService.debug(
        `[DefaultMasterPasswordUnlockService] Error during proof of decryption for user ${userId} returning false: ${error}`,
      );
      return false;
    }
  }

  private validateInput(masterPassword: string, userId: UserId): void {
    if (masterPassword == null || masterPassword === "") {
      throw new Error("Master password is required");
    }
    if (userId == null) {
      throw new Error("User ID is required");
    }
  }

  // Previously unlocking had the side effect of setting the masterKey and masterPasswordHash in state.
  // This is to preserve that behavior, once masterKey and masterPasswordHash state is removed this should be removed as well.
  private async setLegacyState(
    masterPassword: string,
    masterPasswordUnlockData: MasterPasswordUnlockData,
    userId: UserId,
  ): Promise<void> {
    const masterKey = await this.keyService.makeMasterKey(
      masterPassword,
      masterPasswordUnlockData.salt,
      masterPasswordUnlockData.kdf,
    );

    if (!masterKey) {
      throw new Error("Master key could not be created to set legacy master password state.");
    }

    const localKeyHash = await this.keyService.hashMasterKey(
      masterPassword,
      masterKey,
      HashPurpose.LocalAuthorization,
    );

    await this.masterPasswordService.setMasterKeyHash(localKeyHash, userId);
    await this.masterPasswordService.setMasterKey(masterKey, userId);
  }
}
