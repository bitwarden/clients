import { Subscription, concatMap, filter, firstValueFrom, timeout } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AccountCryptographicStateService } from "@bitwarden/common/key-management/account-cryptography/account-cryptographic-state.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { V2UpgradeTokenStateService } from "@bitwarden/common/key-management/upgrade-token/abstractions/v2-upgrade-token-state.service.abstraction";
import { RegisterSdkService } from "@bitwarden/common/platform/abstractions/sdk/register-sdk.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { MessageListener, MessageSender } from "@bitwarden/common/platform/messaging";
import {
  BiometricsService,
  BiometricStateService,
  KdfConfigService,
  KeyService,
} from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";
import { StateProvider } from "@bitwarden/state";
import { AutoUnlockService, CrossContextUnlockService } from "@bitwarden/unlock";
import { UserId } from "@bitwarden/user-core";

import { RENDERER_UNLOCK_COMPLETED, UNLOCK_COMPLETED } from "./unlock-ipc.types";

// The renderer announces its unlock once the user key is in state, so main normally finds it at
// once. Bounded, so a missing key does not hold up the next announced unlock.
const USER_KEY_WAIT_MS = 10_000;

/**
 * The {@link DefaultUnlockService} for the main process. When it unlocks a user, it announces the
 * unlock to the renderer so the renderer can re-seed its own SDK client.
 */
export class MainUnlockService extends CrossContextUnlockService {
  protected readonly announces = UNLOCK_COMPLETED;
  protected readonly listensFor = RENDERER_UNLOCK_COMPLETED;

  // Kept here as well, since the base class holds its own copies privately.
  private readonly mainKeyService: KeyService;
  private readonly mainSdkService: SdkService;
  private readonly mainLogService: LogService;
  private readonly mainMessageListener: MessageListener;

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
    keyService: KeyService,
    sdkService: SdkService,
    autoUnlockService: AutoUnlockService,
    messageSender: MessageSender,
    messageListener: MessageListener,
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
      keyService,
      sdkService,
      autoUnlockService,
      messageSender,
      messageListener,
    );

    this.mainKeyService = keyService;
    this.mainSdkService = sdkService;
    this.mainLogService = logService;
    this.mainMessageListener = messageListener;
  }

  /**
   * Also builds the user's SDK client for each unlock the renderer announces. The renderer's SDK
   * client skips the local unlock migrations, such as storing the length of a PIN set before
   * lengths were stored, and leaves them to main. Main only builds a client when something here
   * needs one, which, for an empty vault, may not happen while unlocked.
   *
   * Unlocks main performs itself are left out: its registered SDK client already ran the
   * migrations while unlocking.
   */
  override init(): Subscription {
    const subscription = super.init();

    subscription.add(
      this.mainMessageListener
        .messages$(RENDERER_UNLOCK_COMPLETED)
        .pipe(concatMap(({ userId }) => this.buildUserClient(userId)))
        .subscribe(),
    );

    return subscription;
  }

  /** Best effort: the unlock has already succeeded, and this only runs the migrations. */
  private async buildUserClient(userId: UserId): Promise<void> {
    try {
      // A client built before the user key reaches main would stay locked.
      await firstValueFrom(
        this.mainKeyService.userKey$(userId).pipe(
          filter((key) => key != null),
          timeout({ first: USER_KEY_WAIT_MS }),
        ),
      );

      // Emits once the client has initialized its crypto, migrations included.
      await firstValueFrom(this.mainSdkService.userClient$(userId));
    } catch (e) {
      this.mainLogService.error(
        "[MainUnlockService] Failed to build the user's SDK client after an unlock in the renderer",
        e,
      );
    }
  }
}
