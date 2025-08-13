import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";

export abstract class UserAsymmetricKeysRegenerationApiService {
  abstract regenerateUserAsymmetricKeys(
    userPublicKey: string,
    userKeyEncryptedUserPrivateKey: EncString,
  ): Promise<void>;
}
