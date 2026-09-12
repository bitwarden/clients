import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { KeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { SymmetricCryptoKey } from "@bitwarden/legacy-crypto";
import { LogService } from "@bitwarden/logging";
import { StateProvider, StateService } from "@bitwarden/state";
import { DefaultAutoUnlockService } from "@bitwarden/unlock";
import { UserId } from "@bitwarden/user-core";

import { CliSessionKeyService } from "../platform/services/cli-session-key.service";

/**
 * Keeps the stored auto-unlock key tied to session keys the user actually holds.
 *
 * The CLI always stores an auto-unlock key, because its vault timeout is fixed to `never`. That
 * key is written through {@link NodeEnvSecureStorageService}, encrypted under
 * `process.env.BW_SESSION`. When the CLI unlocks under a session key it minted for itself — which
 * a shared unlock does, so that a command works with no `BW_SESSION` exported — writing that key
 * would replace the one the user's own exported session decrypts with one that dies at process
 * exit, breaking every later command run under their session.
 *
 * So an ephemeral session leaves the stored key exactly as it found it.
 */
export class CliAutoUnlockService extends DefaultAutoUnlockService {
  constructor(
    keyService: KeyService,
    stateService: StateService,
    stateProvider: StateProvider,
    platformUtilsService: PlatformUtilsService,
    logService: LogService,
    private sessionKeyService: CliSessionKeyService,
  ) {
    super(keyService, stateService, stateProvider, platformUtilsService, logService);
  }

  override async setAutoUnlockKey(userId: UserId, userKey: SymmetricCryptoKey): Promise<void> {
    if (this.sessionKeyService.ephemeral) {
      return;
    }

    await super.setAutoUnlockKey(userId, userKey);
  }
}
