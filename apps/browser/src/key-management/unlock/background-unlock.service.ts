import { filter, firstValueFrom, timeout } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AccountCryptographicStateService } from "@bitwarden/common/key-management/account-cryptography/account-cryptographic-state.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { V2UpgradeTokenStateService } from "@bitwarden/common/key-management/upgrade-token/abstractions/v2-upgrade-token-state.service.abstraction";
import { RegisterSdkService } from "@bitwarden/common/platform/abstractions/sdk/register-sdk.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { MessageListener, MessageSender } from "@bitwarden/common/platform/messaging";
import { UserId } from "@bitwarden/common/types/guid";
import {
  BiometricsService,
  BiometricStateService,
  KdfConfigService,
  KeyService,
} from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { SymmetricCryptoKey } from "@bitwarden/legacy-crypto";
import { LogService } from "@bitwarden/logging";
import { StateProvider } from "@bitwarden/state";
import { AutoUnlockService, CrossContextUnlockService, UnlockMethod } from "@bitwarden/unlock";

import { BACKGROUND_UNLOCK_COMPLETED, FOREGROUND_UNLOCK_COMPLETED } from "./unlock-messages";

// The popup announces its unlock once the user key is in state, so the background normally finds
// it at once. Bounded, since unlock messages are handled one at a time.
const USER_KEY_WAIT_MS = 10_000;

/**
 * The background's unlock service. Unlocks performed here — biometrics, and another device
 * unlocking us over shared unlock — are announced to the popup so its listeners run too.
 */
export class BackgroundUnlockService extends CrossContextUnlockService {
  protected readonly announces = BACKGROUND_UNLOCK_COMPLETED;
  protected readonly listensFor = FOREGROUND_UNLOCK_COMPLETED;

  // Kept here as well, since the base class holds its own copies privately.
  private readonly backgroundKeyService: KeyService;
  private readonly backgroundSdkService: SdkService;
  private readonly backgroundLogService: LogService;

  constructor(
    registerSdkService: RegisterSdkService,
    accountCryptographicStateService: AccountCryptographicStateService,
    kdfService: KdfConfigService,
    accountService: AccountService,
    masterPasswordService: InternalMasterPasswordServiceAbstraction,
    stateProvider: StateProvider,
    logService: LogService,
    biometricsService: BiometricsService,
    biometricStateService: BiometricStateService,
    v2UpgradeTokenStateService: V2UpgradeTokenStateService,
    keyService: KeyService,
    sdkService: SdkService,
    autoUnlockService: AutoUnlockService,
    messageSender: MessageSender,
    messageListener: MessageListener,
  ) {
    super(
      registerSdkService,
      accountCryptographicStateService,
      kdfService,
      accountService,
      masterPasswordService,
      stateProvider,
      logService,
      biometricsService,
      biometricStateService,
      v2UpgradeTokenStateService,
      keyService,
      sdkService,
      autoUnlockService,
      messageSender,
      messageListener,
    );

    this.backgroundKeyService = keyService;
    this.backgroundSdkService = sdkService;
    this.backgroundLogService = logService;
  }

  /**
   * Also builds the user's SDK client, for unlocks the popup performs too. The popup's SDK clients
   * skip the local unlock migrations, such as storing the length of a PIN set before lengths were
   * stored, and leave them to the background. The background only builds a client when something
   * here needs one, which, for an empty vault, may not happen while unlocked.
   */
  override async runOnUnlockActions(
    userId: UserId,
    userKey: SymmetricCryptoKey,
    method: UnlockMethod,
  ): Promise<void> {
    await super.runOnUnlockActions(userId, userKey, method);

    // A client built before the user key reaches the background would stay locked.
    try {
      await firstValueFrom(
        this.backgroundKeyService.userKey$(userId).pipe(
          filter((key) => key != null),
          timeout({ first: USER_KEY_WAIT_MS }),
        ),
      );
    } catch {
      this.backgroundLogService.warning(
        "[BackgroundUnlockService] The user key never reached the background; its SDK client was not built",
      );
      return;
    }

    // Emits once the client has initialized its crypto, migrations included.
    await firstValueFrom(this.backgroundSdkService.userClient$(userId));
  }
}
