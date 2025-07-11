import { WrappedSigningKey } from "@bitwarden/common/key-management/keys/models/signing-key";
import { VerifyingKey } from "@bitwarden/common/key-management/keys/models/verifying-key";
import { SignedSecurityState } from "@bitwarden/common/key-management/security-state/models/security-state";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { UserKey } from "@bitwarden/common/types/key";
import { EncString, UserCryptoV2Response } from "@bitwarden/sdk-internal";

export type V2UserCryptographicState = {
  userKey: UserKey;
  publicKeyEncryptionKeyPair: {
    wrappedPrivateKey: EncString;
    publicKey: string;
    signedPublicKey: string;
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
  response: UserCryptoV2Response,
): V2UserCryptographicState {
  return {
    userKey: SymmetricCryptoKey.fromString(response.userKey) as UserKey,
    publicKeyEncryptionKeyPair: {
      wrappedPrivateKey: response.privateKey,
      publicKey: response.publicKey,
      signedPublicKey: response.signedPublicKey,
    },
    signatureKeyPair: {
      wrappedSigningKey: new WrappedSigningKey(response.signingKey),
      verifyingKey: new VerifyingKey(response.verifyingKey),
    },
    securityState: {
      securityState: new SignedSecurityState(response.securityState),
      securityStateVersion: response.securityVersion,
    },
  };
}
