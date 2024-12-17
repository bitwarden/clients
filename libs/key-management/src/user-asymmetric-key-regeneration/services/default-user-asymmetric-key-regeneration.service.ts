import { combineLatest, firstValueFrom, map } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";

import { KeyService } from "../../abstractions/key.service";
import { UserAsymmetricKeysRegenerationApiService } from "../abstractions/user-asymmetric-key-regeneration-api.service";
import { UserAsymmetricKeysRegenerationService } from "../abstractions/user-asymmetric-key-regeneration.service";

export class DefaultUserAsymmetricKeysRegenerationService
  implements UserAsymmetricKeysRegenerationService
{
  constructor(
    private keyService: KeyService,
    private cipherService: CipherService,
    private userAsymmetricKeysRegenerationApiService: UserAsymmetricKeysRegenerationApiService,
    private logService: LogService,
    private sdkService: SdkService,
    private apiService: ApiService,
    private configService: ConfigService,
  ) {}

  async regenerateIfNeeded(userId: UserId): Promise<void> {
    try {
      const privateKeyRegenerationFlag = await this.configService.getFeatureFlag(
        FeatureFlag.PrivateKeyRegeneration,
      );

      if (privateKeyRegenerationFlag) {
        const shouldRegenerate = await this.shouldRegenerate(userId);
        if (shouldRegenerate) {
          await this.regenerateUserAsymmetricKeys(userId);
        }
      }
    } catch (error) {
      this.logService.error(
        "[UserAsymmetricKeyRegeneration] An error occurred: " +
          error +
          " Skipping regeneration for the user.",
      );
    }
  }

  private async shouldRegenerate(userId: UserId): Promise<boolean> {
    const [userKey, userKeyEncryptedPrivateKey, publicKeyResponse] = await firstValueFrom(
      combineLatest([
        this.keyService.userKey$(userId),
        this.keyService.userEncryptedPrivateKey$(userId),
        this.apiService.getUserPublicKey(userId),
      ]),
    );

    const verificationResponse = await firstValueFrom(
      this.sdkService.client$.pipe(
        map((sdk) => {
          if (sdk === undefined) {
            throw new Error("SDK is undefined");
          }
          return sdk.crypto().verify_asymmetric_keys({
            userKey: userKey.keyB64,
            userPublicKey: publicKeyResponse.publicKey,
            userKeyEncryptedPrivateKey: userKeyEncryptedPrivateKey,
          });
        }),
      ),
    );

    if (verificationResponse.privateKeyDecryptable) {
      if (verificationResponse.validPrivateKey) {
        // The private key is decryptable and valid. Should not regenerate.
        return false;
      } else {
        // The private key is decryptable but not valid so we should regenerate it.
        this.logService.info(
          "[UserAsymmetricKeyRegeneration] User's private key is decryptable but not a valid key, attempting regeneration.",
        );
        return true;
      }
    }

    // The private isn't decryptable, check to see if we can decrypt something with the userKey.
    const userKeyCanDecrypt = await this.userKeyCanDecrypt(userKey);
    if (userKeyCanDecrypt) {
      this.logService.info(
        "[UserAsymmetricKeyRegeneration] User Asymmetric Key decryption failure detected, attempting regeneration.",
      );
      return true;
    }

    this.logService.warning(
      "[UserAsymmetricKeyRegeneration] User Asymmetric Key decryption failure detected, but unable to determine User Symmetric Key validity, skipping regeneration.",
    );
    return false;
  }

  private async regenerateUserAsymmetricKeys(userId: UserId): Promise<void> {
    const userKey = await firstValueFrom(this.keyService.userKey$(userId));
    const makeKeyPairResponse = await firstValueFrom(
      this.sdkService.client$.pipe(
        map((sdk) => {
          if (sdk === undefined) {
            throw new Error("SDK is undefined");
          }
          return sdk.crypto().make_key_pair(userKey.keyB64);
        }),
      ),
    );

    try {
      await this.userAsymmetricKeysRegenerationApiService.regenerateUserAsymmetricKeys(
        makeKeyPairResponse.userPublicKey,
        new EncString(makeKeyPairResponse.userKeyEncryptedPrivateKey),
      );
    } catch (error: any) {
      if (error?.message === "Key regeneration not supported for this user.") {
        this.logService.info(
          "[UserAsymmetricKeyRegeneration] Regeneration not supported for this user at this time.",
        );
      } else {
        this.logService.error(
          "[UserAsymmetricKeyRegeneration] Regeneration error when submitting the request to the server: " +
            error,
        );
      }
      return;
    }

    await this.keyService.setPrivateKey(makeKeyPairResponse.userKeyEncryptedPrivateKey, userId);
    this.logService.info(
      "[UserAsymmetricKeyRegeneration] User's asymmetric keys successfully regenerated.",
    );
  }

  private async userKeyCanDecrypt(userKey: UserKey): Promise<boolean> {
    const ciphers = await this.cipherService.getAll();
    const cipher = ciphers.find((cipher) => cipher.organizationId == null);

    if (cipher != null) {
      try {
        await cipher.decrypt(userKey);
        return true;
      } catch (error) {
        this.logService.error(
          "[UserAsymmetricKeyRegeneration] User Symmetric Key validation error: " + error,
        );
        return false;
      }
    }
    return false;
  }
}
