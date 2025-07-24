import { combineLatest, firstValueFrom, map } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
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
    const userKey = await firstValueFrom(this.keyService.userKey$(userId));

    // For SSO logins from untrusted devices, the userKey will not be available, and the private key regeneration process should be skipped.
    // In such cases, regeneration will occur on the following device login flow.
    if (!userKey) {
      this.logService.info(
        "[UserAsymmetricKeyRegeneration] User symmetric key unavailable, skipping regeneration for the user.",
      );
      return false;
    }

    if (userKey.inner().type === 
        .CoseEncrypt0) {
      this.logService.error(
        "[UserAsymmetricKeyRegeneration] Cannot regenerate asymmetric keys for accounts on V2 encryption.",
      );
      return false;
    }

    const [userKeyEncryptedPrivateKey, publicKeyResponse] = await firstValueFrom(
      combineLatest([
        this.keyService.userEncryptedPrivateKey$(userId),
        this.apiService.getUserPublicKey(userId),
      ]),
    );

    if (!userKeyEncryptedPrivateKey || !publicKeyResponse) {
      this.logService.warning(
        "[UserAsymmetricKeyRegeneration] User's asymmetric key initialization data is unavailable, skipping regeneration.",
      );
      return false;
    }

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
    const userKeyCanDecrypt = await this.userKeyCanDecrypt(userKey, userId);
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
    if (userKey == null) {
      throw new Error("User key not found");
    }
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

  private async userKeyCanDecrypt(userKey: UserKey, userId: UserId): Promise<boolean> {
    const ciphers = await this.cipherService.getAll(userId);
    const cipher = ciphers.find((cipher) => cipher.organizationId == null);

    if (!cipher) {
      return false;
    }

    try {
      const cipherView = await cipher.decrypt(userKey);

      if (cipherView.decryptionFailure) {
        this.logService.error(
          "[UserAsymmetricKeyRegeneration] User Symmetric Key validation error: Cipher decryption failed",
        );
        return false;
      }

      return true;
    } catch (error) {
      this.logService.error(
        "[UserAsymmetricKeyRegeneration] User Symmetric Key validation error: " + error,
      );
      return false;
    }
  }
}
