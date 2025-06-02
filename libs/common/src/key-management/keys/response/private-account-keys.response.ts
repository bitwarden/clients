import { AsymmetricEncryptionDataResponse } from "./asymmetric-encryption-keys.response";
import { UserSigningKeyData } from "./signing-keys.response";

export class PrivateAccountKeysResponseModel {
  readonly SigningKeys: UserSigningKeyData | null = null;
  readonly AsymmetricEncryptionKeys: AsymmetricEncryptionDataResponse;

  constructor(response: any) {
    if ("signingKeys" in response && response.signingKeys != null) {
      this.SigningKeys = new UserSigningKeyData(response.signingKeys);
    }

    this.AsymmetricEncryptionKeys = new AsymmetricEncryptionDataResponse(
      response.asymmetricEncryptionKeys,
    );
  }
}
