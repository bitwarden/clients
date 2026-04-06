import { SecurityStateRequest } from "@bitwarden/common/key-management/security-state/request/security-state.request";
import { WrappedPrivateKey } from "@bitwarden/common/key-management/types";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { PureCrypto } from "@bitwarden/sdk-internal";

import { PublicKeyEncryptionKeyPairRequestModel } from "../model/public-key-encryption-key-pair-request.model";
import { SignatureKeyPairRequestModel } from "../model/signature-key-pair-request-request.model";
import { V1UserCryptographicState } from "../types/v1-cryptographic-state";
import { V2UserCryptographicState } from "../types/v2-cryptographic-state";

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

  static async fromV2CryptographicState(
    state: V2UserCryptographicState,
  ): Promise<AccountKeysRequest> {
    // Ensure the SDK is loaded, since it is used to derive the signature algorithm.
    await SdkLoadService.Ready;

    const request = new AccountKeysRequest();
    request.userKeyEncryptedAccountPrivateKey = state.publicKeyEncryptionKeyPair.wrappedPrivateKey!;
    request.accountPublicKey = Utils.fromBufferToB64(state.publicKeyEncryptionKeyPair.publicKey);
    request.publicKeyEncryptionKeyPair = new PublicKeyEncryptionKeyPairRequestModel(
      state.publicKeyEncryptionKeyPair.wrappedPrivateKey,
      state.publicKeyEncryptionKeyPair.publicKey,
      state.publicKeyEncryptionKeyPair.signedPublicKey,
    );
    request.signatureKeyPair = new SignatureKeyPairRequestModel(
      state.signatureKeyPair.wrappedSigningKey,
      state.signatureKeyPair.verifyingKey,
      PureCrypto.key_algorithm_for_verifying_key(
        Utils.fromB64ToArray(state.signatureKeyPair.verifyingKey),
      ),
    );
    request.securityState = new SecurityStateRequest(
      state.securityState.securityState,
      state.securityState.securityStateVersion,
    );

    return request;
  }
}
