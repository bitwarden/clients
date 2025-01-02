import { EncString } from "../../cryptography/domain/enc-string";

export abstract class UserAsymmetricKeysRegenerationApiService {
  abstract regenerateUserAsymmetricKeys(
    userPublicKey: string,
    userKeyEncryptedUserPrivateKey: EncString,
  ): Promise<void>;
}
