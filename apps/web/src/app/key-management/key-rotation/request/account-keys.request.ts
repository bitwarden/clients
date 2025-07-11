import { SecurityStateRequest } from "@bitwarden/common/key-management/security-state/request/security-state.request";

import { PublicKeyEncryptionKeyPairRequestModel } from "../model/public-key-encryption-keypair-request.model";
import { SignatureKeyPairRequestModel } from "../model/signature-keypair-request-request.model";
import { V1UserCryptographicState } from "../types/v1-cryptographic-state";
import { V2UserCryptographicState } from "../types/v2-cryptographic-state";

// This request contains other account-owned keys that are encrypted with the user key.
export class AccountKeysRequest {
  /**
   * @deprecated
   */
  userKeyEncryptedAccountPrivateKey: string;
  /**
   * @deprecated
   */
  accountPublicKey: string;

  publicKeyEncryptionKeyPair: PublicKeyEncryptionKeyPairRequestModel | null;
  signatureKeyPair: SignatureKeyPairRequestModel | null = null;
  securityState: SecurityStateRequest | null = null;

  constructor() {}

  static fromV1CryptographicState(state: V1UserCryptographicState): AccountKeysRequest {
    const request = new AccountKeysRequest();
    request.userKeyEncryptedAccountPrivateKey = state.publicKeyEncryptionKeyPair.wrappedPrivateKey;
    request.accountPublicKey = state.publicKeyEncryptionKeyPair.publicKey;
    request.publicKeyEncryptionKeyPair = new PublicKeyEncryptionKeyPairRequestModel(
      state.publicKeyEncryptionKeyPair.wrappedPrivateKey,
      state.publicKeyEncryptionKeyPair.publicKey,
      null,
    );

    return request;
  }

  static async fromV2CryptographicState(
    state: V2UserCryptographicState,
  ): Promise<AccountKeysRequest> {
    const request = new AccountKeysRequest();
    request.userKeyEncryptedAccountPrivateKey = state.publicKeyEncryptionKeyPair.wrappedPrivateKey!;
    request.accountPublicKey = state.publicKeyEncryptionKeyPair.publicKey;
    request.publicKeyEncryptionKeyPair = new PublicKeyEncryptionKeyPairRequestModel(
      state.publicKeyEncryptionKeyPair.wrappedPrivateKey,
      state.publicKeyEncryptionKeyPair.publicKey,
      state.publicKeyEncryptionKeyPair.signedPublicKey,
    );
    request.signatureKeyPair = new SignatureKeyPairRequestModel(
      state.signatureKeyPair.wrappedSigningKey,
      state.signatureKeyPair.verifyingKey,
      await state.signatureKeyPair.verifyingKey.algorithm(),
    );
    request.securityState = new SecurityStateRequest(
      state.securityState.securityState.securityState,
      state.securityState.securityStateVersion,
    );

    return request;
  }
}
