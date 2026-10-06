import { SecurityStateRequest } from "@bitwarden/common/key-management/security-state/request/security-state.request";
import { Utils } from "@bitwarden/common/platform/misc/utils";
// eslint-disable-next-line no-restricted-imports
import { WrappedPrivateKey } from "@bitwarden/legacy-crypto";

import { PublicKeyEncryptionKeyPairRequestModel } from "../model/public-key-encryption-key-pair-request.model";
import { SignatureKeyPairRequestModel } from "../model/signature-key-pair-request-request.model";
import { V1UserCryptographicState } from "../types/v1-cryptographic-state";

// This request contains other account-owned keys that are encrypted with the user key.
export class AccountKeysRequest {
  /**
   * @deprecated
   */
  userKeyEncryptedAccountPrivateKey: WrappedPrivateKey | null = null;
  /**
   * @deprecated
   */
  accountPublicKey: string | null = null;

  publicKeyEncryptionKeyPair: PublicKeyEncryptionKeyPairRequestModel | null = null;
  signatureKeyPair: SignatureKeyPairRequestModel | null = null;
  securityState: SecurityStateRequest | null = null;

  constructor() {}

  static fromV1CryptographicState(state: V1UserCryptographicState): AccountKeysRequest {
    const request = new AccountKeysRequest();
    request.userKeyEncryptedAccountPrivateKey = state.publicKeyEncryptionKeyPair.wrappedPrivateKey;
    request.accountPublicKey = Utils.fromBufferToB64(state.publicKeyEncryptionKeyPair.publicKey);
    request.publicKeyEncryptionKeyPair = new PublicKeyEncryptionKeyPairRequestModel(
      state.publicKeyEncryptionKeyPair.wrappedPrivateKey,
      state.publicKeyEncryptionKeyPair.publicKey,
      null,
    );

    return request;
  }
}
