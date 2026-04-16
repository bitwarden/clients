import { firstValueFrom, map } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { AccountCryptographicStateService } from "@bitwarden/common/key-management/account-cryptography/account-cryptographic-state.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { UserId } from "@bitwarden/common/types/guid";

import { KeyService } from "../../abstractions/key.service";
import { UserAsymmetricKeysRegenerationService } from "../abstractions/user-asymmetric-key-regeneration.service";

export class DefaultUserAsymmetricKeysRegenerationService implements UserAsymmetricKeysRegenerationService {
  constructor(
    private keyService: KeyService,
    private logService: LogService,
    private sdkService: SdkService,
    private configService: ConfigService,
    private accountCryptographyStateService: AccountCryptographicStateService,
  ) {}

  async regenerateIfNeeded(userId: UserId): Promise<void> {
    try {
      const privateKeyRegenerationFlag = await this.configService.getFeatureFlag(
        FeatureFlag.PrivateKeyRegeneration,
      );

      if (privateKeyRegenerationFlag) {
        const shouldRegenerate = await this.shouldRegenerate(userId);
        if (shouldRegenerate) {
          await this.regenerateUserPublicKeyEncryptionKeyPair(userId);
        }
      }
    } catch (error) {
      this.logService.error(
        "[UserAsymmetricKeyRegeneration] An error occurred. Skipping regeneration for the user.",
        error,
      );
    }
  }

  async shouldRegenerate(userId: UserId): Promise<boolean> {
    const userKey = await firstValueFrom(this.keyService.userKey$(userId));
    if (userKey == null) {
      return false;
    }

    return await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        map((sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }

          using ref = sdk.take();
          return ref.value.user_crypto_management().should_regenerate_asymmetric_keys();
        }),
      ),
    );
  }

  async regenerateUserPublicKeyEncryptionKeyPair(userId: UserId): Promise<boolean> {
    const userKey = await firstValueFrom(this.keyService.userKey$(userId));
    if (userKey == null) {
      throw new Error("User key not found");
    }

    const newAccountCryptoState = await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        map((sdk) => {
          if (!sdk) {
            throw new Error("SDK not available");
          }

          using ref = sdk.take();
          return ref.value.user_crypto_management().regenerate_asymmetric_key_pair_if_needed();
        }),
      ),
    );

    if (newAccountCryptoState != null) {
      await this.accountCryptographyStateService.setAccountCryptographicState(
        newAccountCryptoState,
        userId,
      );
      this.logService.info(
        "[UserAsymmetricKeyRegeneration] User's asymmetric keys successfully regenerated.",
      );
      return true;
    }
    return false;
  }
}
