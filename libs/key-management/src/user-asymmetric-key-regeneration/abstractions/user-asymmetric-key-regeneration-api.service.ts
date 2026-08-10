// eslint-disable-next-line no-restricted-imports
import { EncString } from "@bitwarden/legacy-crypto";

export abstract class UserAsymmetricKeysRegenerationApiService {
  abstract regenerateUserAsymmetricKeys(
    userPublicKey: string,
    userKeyEncryptedUserPrivateKey: EncString,
  ): Promise<void>;
}
