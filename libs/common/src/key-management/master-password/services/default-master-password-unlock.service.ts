import { firstValueFrom } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { KeyService } from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";
import { isCryptoError } from "@bitwarden/sdk-internal";
import { UserId } from "@bitwarden/user-core";

import { UserKey } from "../../../types/key";
import { MasterPasswordUnlockService } from "../abstractions/master-password-unlock.service";
import { InternalMasterPasswordServiceAbstraction } from "../abstractions/master-password.service.abstraction";
import { MasterPasswordUnlockData } from "../types/master-password.types";

export class DefaultMasterPasswordUnlockService implements MasterPasswordUnlockService {
  constructor(
    private readonly masterPasswordService: InternalMasterPasswordServiceAbstraction,
    private readonly keyService: KeyService,
    private readonly logService: LogService,
  ) { }

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
      // Currently this throws CryptoError:InvalidKey if decrypting the user key fails at all.
      if (isCryptoError(error) && error.variant === "InvalidKey") {
        this.logService.debug(
          `[DefaultMasterPasswordUnlockService] Error during proof of decryption for user ${userId} returning false: ${error}`,
        );
      } else {
        this.logService.error(
          `[DefaultMasterPasswordUnlockService] Unexpected error during proof of decryption for user ${userId} returning false: ${error}`,
        );
      }
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
}
