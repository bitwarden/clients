import { ApiService } from "@bitwarden/common/abstractions/api.service";
// eslint-disable-next-line no-restricted-imports
import { EncString } from "@bitwarden/legacy-crypto";

import { UserAsymmetricKeysRegenerationApiService } from "../abstractions/user-asymmetric-key-regeneration-api.service";
import { KeyRegenerationRequest } from "../models/requests/key-regeneration.request";

export class DefaultUserAsymmetricKeysRegenerationApiService implements UserAsymmetricKeysRegenerationApiService {
  constructor(private apiService: ApiService) {}

  async regenerateUserAsymmetricKeys(
    userPublicKey: string,
    userKeyEncryptedUserPrivateKey: EncString,
  ): Promise<void> {
    const request: KeyRegenerationRequest = {
      userPublicKey,
      userKeyEncryptedUserPrivateKey,
    };

    await this.apiService.send(
      "POST",
      "/accounts/key-management/regenerate-keys",
      request,
      true,
      true,
    );
  }
}
