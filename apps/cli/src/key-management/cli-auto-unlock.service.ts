// eslint-disable-next-line no-restricted-imports
import { SymmetricCryptoKey } from "@bitwarden/legacy-crypto";
import { DefaultAutoUnlockService } from "@bitwarden/unlock";
import { UserId } from "@bitwarden/user-core";

/**
 * Skips storing the never-lock key when the process has no session key.
 *
 * The key is stored encrypted under `BW_SESSION`. A shared unlock from the desktop app runs with
 * none set, so there is nothing to encrypt under, and clearing the key instead would wipe the one
 * the user's exported session decrypts.
 */
export class CliAutoUnlockService extends DefaultAutoUnlockService {
  override async setAutoUnlockKey(userId: UserId, userKey: SymmetricCryptoKey): Promise<void> {
    if (process.env.BW_SESSION == null || process.env.BW_SESSION === "") {
      return;
    }

    await super.setAutoUnlockKey(userId, userKey);
  }
}
