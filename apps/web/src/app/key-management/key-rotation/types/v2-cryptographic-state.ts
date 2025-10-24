import {
  SignedSecurityState,
  UnsignedPublicKey,
  VerifyingKey,
  WrappedPrivateKey,
  WrappedSigningKey,
} from "@bitwarden/common/key-management/types";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { UserKey } from "@bitwarden/common/types/key";
import { SignedPublicKey, UserCryptoV2KeysResponse } from "@bitwarden/sdk-internal";

export type V2UserCryptographicState = {
  userKey: UserKey;
  publicKeyEncryptionKeyPair: {
    wrappedPrivateKey: WrappedPrivateKey;
    publicKey: UnsignedPublicKey;
    signedPublicKey: SignedPublicKey;
  };
  signatureKeyPair: {
    wrappedSigningKey: WrappedSigningKey;
    verifyingKey: VerifyingKey;
  };
  securityState: {
    securityState: SignedSecurityState;
    securityStateVersion: number;
  };
};

export function fromSdkV2KeysToV2UserCryptographicState(
  response: UserCryptoV2KeysResponse,
): V2UserCryptographicState {
  return {
    userKey: SymmetricCryptoKey.fromString(response.userKey) as UserKey,
    publicKeyEncryptionKeyPair: {
      wrappedPrivateKey: response.privateKey as WrappedPrivateKey,
      publicKey: Utils.fromB64ToArray(response.publicKey) as UnsignedPublicKey,
      signedPublicKey: response.signedPublicKey,
    },
    signatureKeyPair: {
      wrappedSigningKey: response.signingKey as WrappedSigningKey,
      verifyingKey: response.verifyingKey as VerifyingKey,
    },
    securityState: {
      securityState: response.securityState as SignedSecurityState,
      securityStateVersion: response.securityVersion,
    },
  };
}
