import { firstValueFrom, map } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AccountCryptographicStateService } from "@bitwarden/common/key-management/account-cryptography/account-cryptographic-state.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { PinStateServiceAbstraction } from "@bitwarden/common/key-management/pin/pin-state.service.abstraction";
import { RegisterSdkService } from "@bitwarden/common/platform/abstractions/sdk/register-sdk.service";
import { asUuid } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { KdfConfig, KdfConfigService } from "@bitwarden/key-management";
import {
  Kdf,
  MasterPasswordUnlockData,
  PasswordProtectedKeyEnvelope,
  WrappedAccountCryptographicState,
} from "@bitwarden/sdk-internal";
import { UserId } from "@bitwarden/user-core";

import { UnlockService } from "./unlock.service";

export class DefaultUnlockService implements UnlockService {
  constructor(
    private registerSdkService: RegisterSdkService,
    private accountCryptographicStateService: AccountCryptographicStateService,
    private pinStateService: PinStateServiceAbstraction,
    private kdfService: KdfConfigService,
    private accountService: AccountService,
    private masterPasswordService: InternalMasterPasswordServiceAbstraction,
  ) {}

  private async getAccountCryptographicState(
    userId: UserId,
  ): Promise<WrappedAccountCryptographicState> {
    return firstValueFrom(this.accountCryptographicStateService.accountCryptographicState$(userId));
  }

  private async getKdfParams(userId: UserId): Promise<Kdf> {
    return firstValueFrom(
      this.kdfService.getKdfConfig$(userId).pipe(
        map((config: KdfConfig) => {
          return config.toSdkConfig();
        }),
      ),
    );
  }

  private async getEmail(userId: UserId): Promise<string | null> {
    const accounts = await firstValueFrom(this.accountService.accounts$);
    return accounts[userId]?.email;
  }

  private async getPinProtectedUserKeyEnvelope(
    userId: UserId,
  ): Promise<PasswordProtectedKeyEnvelope | null> {
    const pinLockType = await this.pinStateService.getPinLockType(userId);
    return this.pinStateService.getPinProtectedUserKeyEnvelope(userId, pinLockType);
  }

  private async getMasterPasswordUnlockData(
    userId: UserId,
  ): Promise<MasterPasswordUnlockData | null> {
    const unlockData = await firstValueFrom(
      this.masterPasswordService.masterPasswordUnlockData$(userId),
    );
    return unlockData.toSdk();
  }

  async unlockWithPin(userId: UserId, pin: string): Promise<void> {
    await firstValueFrom(
      this.registerSdkService.registerClient$(userId).pipe(
        map(async (sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }
          using ref = sdk.take();
          return ref.value.crypto().initialize_user_crypto({
            userId: asUuid(userId),
            kdfParams: await this.getKdfParams(userId),
            email: await this.getEmail(userId),
            accountCryptographicState: await this.getAccountCryptographicState(userId),
            method: {
              pinEnvelope: {
                pin: pin,
                pin_protected_user_key_envelope: await this.getPinProtectedUserKeyEnvelope(userId),
              },
            },
          });
        }),
      ),
    );
  }

  async unlockWithMasterPassword(userId: UserId, masterPassword: string): Promise<void> {
    await firstValueFrom(
      this.registerSdkService.registerClient$(userId).pipe(
        map(async (sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }
          using ref = sdk.take();
          return ref.value.crypto().initialize_user_crypto({
            userId: asUuid(userId),
            kdfParams: await this.getKdfParams(userId),
            email: await this.getEmail(userId),
            accountCryptographicState: await this.getAccountCryptographicState(userId),
            method: {
              masterPasswordUnlock: {
                password: masterPassword,
                master_password_unlock: await this.getMasterPasswordUnlockData(userId),
              },
            },
          });
        }),
      ),
    );
  }
}
