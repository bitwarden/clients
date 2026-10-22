import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AccountCryptographicStateService } from "@bitwarden/common/key-management/account-cryptography/account-cryptographic-state.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { V2UpgradeTokenStateService } from "@bitwarden/common/key-management/upgrade-token/abstractions/v2-upgrade-token-state.service.abstraction";
import { RegisterSdkService } from "@bitwarden/common/platform/abstractions/sdk/register-sdk.service";
import { MessageSender } from "@bitwarden/common/platform/messaging";
import {
  BiometricsService,
  BiometricStateService,
  KdfConfigService,
} from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { SymmetricCryptoKey } from "@bitwarden/legacy-crypto";
import { LogService } from "@bitwarden/logging";
import { StateProvider } from "@bitwarden/state";
import { AutoUnlockService, DefaultUnlockService, UnlockMethod } from "@bitwarden/unlock";
import { UserId } from "@bitwarden/user-core";

import { UNLOCK_COMPLETED } from "./unlock-ipc.types";

/**
 * The {@link DefaultUnlockService} for the main process. When it unlocks a user, it announces the
 * unlock to the renderer so the renderer can re-seed its own SDK client.
 */
export class MainUnlockService extends DefaultUnlockService {
  constructor(
    registerSdkService: RegisterSdkService,
    accountCryptographicStateService: AccountCryptographicStateService,
    kdfConfigService: KdfConfigService,
    accountService: AccountService,
    masterPasswordService: InternalMasterPasswordServiceAbstraction,
    stateProvider: StateProvider,
    logService: LogService,
    biometricsService: BiometricsService,
    biometricStateService: BiometricStateService,
    v2UpgradeTokenStateService: V2UpgradeTokenStateService,
    autoUnlockService: AutoUnlockService,
    private readonly messageSender: MessageSender,
  ) {
    super(
      registerSdkService,
      accountCryptographicStateService,
      kdfConfigService,
      accountService,
      masterPasswordService,
      stateProvider,
      logService,
      biometricsService,
      biometricStateService,
      v2UpgradeTokenStateService,
      autoUnlockService,
    );
  }

  protected override async runUnlockActionInOtherProcess(
    userId: UserId,
    userKey: SymmetricCryptoKey,
    method: UnlockMethod,
  ): Promise<void> {
    this.messageSender.send(UNLOCK_COMPLETED, {
      userId,
      userKeyB64: userKey.toBase64(),
      method,
    });
  }
}
