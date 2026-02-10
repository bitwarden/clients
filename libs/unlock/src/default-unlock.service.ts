import { firstValueFrom, map } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { assertNonNullish } from "@bitwarden/common/auth/utils";
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
            email: await this.getEmail(userId)!,
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

  private async getAccountCryptographicState(
    userId: UserId,
  ): Promise<WrappedAccountCryptographicState> {
    const accountCryptographicState = await firstValueFrom(
      this.accountCryptographicStateService.accountCryptographicState$(userId),
    );
    assertNonNullish(accountCryptographicState, "Account cryptographic state is required");
    return accountCryptographicState!;
  }

  private async getKdfParams(userId: UserId): Promise<Kdf> {
    const kdfParams = await firstValueFrom(
      this.kdfService.getKdfConfig$(userId).pipe(
        map((config: KdfConfig | null) => {
          return config?.toSdkConfig();
        }),
      ),
    );
    assertNonNullish(kdfParams, "KDF parameters are required");
    return kdfParams!;
  }

  private async getEmail(userId: UserId): Promise<string> {
    const accounts = await firstValueFrom(this.accountService.accounts$);
    const email = accounts[userId].email;
    assertNonNullish(email, "Email is required");
    return email;
  }

  private async getPinProtectedUserKeyEnvelope(
    userId: UserId,
  ): Promise<PasswordProtectedKeyEnvelope> {
    const pinLockType = await this.pinStateService.getPinLockType(userId);
    const pinEnvelope = await this.pinStateService.getPinProtectedUserKeyEnvelope(
      userId,
      pinLockType,
    );
    assertNonNullish(pinEnvelope, "User is not enrolled in PIN unlock");
    return pinEnvelope!;
  }

  private async getMasterPasswordUnlockData(userId: UserId): Promise<MasterPasswordUnlockData> {
    const unlockData = await firstValueFrom(
      this.masterPasswordService.masterPasswordUnlockData$(userId),
    );
    assertNonNullish(unlockData, "Master password unlock data is required");
    return unlockData.toSdk();
  }
}
