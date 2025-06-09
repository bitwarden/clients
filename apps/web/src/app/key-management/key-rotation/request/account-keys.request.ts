import { SigningKeyType } from "@bitwarden/common/key-management/enums/signing-key-type.enum";
import { SigningKey } from "@bitwarden/common/key-management/keys/models/signing-key";
import { VerifyingKey } from "@bitwarden/common/key-management/keys/models/verifying-key";
import { SignedPublicKey } from "@bitwarden/common/key-management/types";

// This request contains other account-owned keys that are encrypted with the user key.
export class AccountKeysRequest {
  userKeyEncryptedAccountPrivateKey: string;
  accountPublicKey: string;

  // Cleanup: These should be non-optional after the featureflag is rolled out, and users MUST upgrade https://bitwarden.atlassian.net/browse/PM-21768
  signedPublicKeyOwnershipClaim: string | null;

  userKeyEncryptedSigningKey: string | null;
  verifyingKey: string | null;
  signingKeyType: SigningKeyType | null;

  constructor(
    userKeyEncryptedAccountPrivateKey: string,
    accountPublicKey: string,
    signedPublicKeyOwnershipClaim: SignedPublicKey | null,
    userKeyEncryptedSigningKey: SigningKey | null,
    verifyingKey: VerifyingKey | null,
  ) {
    this.userKeyEncryptedAccountPrivateKey = userKeyEncryptedAccountPrivateKey;
    this.accountPublicKey = accountPublicKey;
    this.signedPublicKeyOwnershipClaim = signedPublicKeyOwnershipClaim;
    this.userKeyEncryptedSigningKey = userKeyEncryptedSigningKey.inner().toString();
    this.verifyingKey = verifyingKey.toString();
    this.signingKeyType = verifyingKey?.algorithm();
  }
}
