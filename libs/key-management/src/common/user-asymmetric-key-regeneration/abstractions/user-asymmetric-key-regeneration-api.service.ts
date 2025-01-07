import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";

export abstract class UserAsymmetricKeysRegenerationApiService {
  abstract regenerateUserAsymmetricKeys(
    userPublicKey: string,
    userKeyEncryptedUserPrivateKey: EncString,
  ): Promise<void>;
}
