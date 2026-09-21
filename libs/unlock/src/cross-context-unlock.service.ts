import { Subscription, concatMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AccountCryptographicStateService } from "@bitwarden/common/key-management/account-cryptography/account-cryptographic-state.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { V2UpgradeTokenStateService } from "@bitwarden/common/key-management/upgrade-token/abstractions/v2-upgrade-token-state.service.abstraction";
import { RegisterSdkService } from "@bitwarden/common/platform/abstractions/sdk/register-sdk.service";
import {
  CommandDefinition,
  MessageListener,
  MessageSender,
} from "@bitwarden/common/platform/messaging";
import {
  BiometricsService,
  BiometricStateService,
  KdfConfigService,
} from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { SymmetricCryptoKey } from "@bitwarden/legacy-crypto";
import { LogService } from "@bitwarden/logging";
import { StateProvider } from "@bitwarden/state";
import { UserId } from "@bitwarden/user-core";

import { AutoUnlockService } from "./auto-unlock.service";
import { DefaultUnlockService } from "./default-unlock.service";
import { UnlockMethod } from "./unlock-method.enum";

/**
 * An unlock one context of a client is announcing to the other.
 */
export type UnlockCompletedMessage = {
  userId: UserId;
  userKeyB64: string;
  method: UnlockMethod;
};

/**
 * The unlock service of a client that unlocks in more than one context.
 *
 * Either context may perform the unlock — the browser extension unlocks in the background for
 * biometrics and shared unlock and in the popup for passwords; the desktop app unlocks in the
 * renderer — while on-unlock listeners such as the shared unlock peer live in only one of them. So
 * every unlock has to be routed to the other context, which runs its own listeners for it.
 */
export abstract class CrossContextUnlockService extends DefaultUnlockService {
  /** What this context announces its own unlocks as. */
  protected abstract readonly announces: CommandDefinition<UnlockCompletedMessage>;
  /** What the other context announces its unlocks as. */
  protected abstract readonly listensFor: CommandDefinition<UnlockCompletedMessage>;

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
    autoUnlockService: AutoUnlockService,
    private readonly messageSender: MessageSender,
    private readonly messageListener: MessageListener,
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
      autoUnlockService,
    );
  }

  /**
   * Starts running this context's on-unlock actions for the unlocks the other context announces.
   */
  init(): Subscription {
    return this.messageListener
      .messages$(this.listensFor)
      .pipe(
        concatMap(async ({ userId, userKeyB64, method }) => {
          try {
            await this.runOnUnlockActions(
              userId,
              SymmetricCryptoKey.fromString(userKeyB64),
              method,
            );
          } catch (e) {
            this.logService.error(
              "[CrossContextUnlockService] Failed to run the on-unlock actions for an unlock performed in this client's other context",
              e,
            );
          }
        }),
      )
      .subscribe();
  }

  protected override async runUnlockActionInOtherProcess(
    userId: UserId,
    userKey: SymmetricCryptoKey,
    method: UnlockMethod,
  ): Promise<void> {
    this.messageSender.send(this.announces, { userId, userKeyB64: userKey.toBase64(), method });
  }
}
