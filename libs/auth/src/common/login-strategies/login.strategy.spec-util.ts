import { IdentityTokenResponse } from "@bitwarden/common/auth/models/response/identity-token.response";
import { MasterPasswordPolicyResponse } from "@bitwarden/common/auth/models/response/master-password-policy.response";
import { IUserDecryptionOptionsServerResponse } from "@bitwarden/common/auth/models/response/user-decryption-options/user-decryption-options.response";

export const email = "hello@world.com";
export const accessToken = "ACCESS_TOKEN";
export const refreshToken = "REFRESH_TOKEN";
export const encryptedUserKey = "USER_KEY";
const privateKey = "PRIVATE_KEY";
const kdf = 0;
export const kdfIterations = 10000;
const defaultUserDecryptionOptionsServerResponse: IUserDecryptionOptionsServerResponse = {
  HasMasterPassword: true,
  MasterPasswordUnlock: {
    Salt: email,
    Kdf: {
      KdfType: kdf,
      Iterations: kdfIterations,
    },
    MasterKeyEncryptedUserKey: encryptedUserKey,
  },
};

export function identityTokenResponseFactory(
  masterPasswordPolicyResponse: MasterPasswordPolicyResponse | undefined = undefined,
  userDecryptionOptions: IUserDecryptionOptionsServerResponse | undefined = undefined,
) {
  return new IdentityTokenResponse({
    ForcePasswordReset: false,
    Kdf: kdf,
    KdfIterations: kdfIterations,
    Key: encryptedUserKey,
    PrivateKey: privateKey,
    access_token: accessToken,
    expires_in: 3600,
    refresh_token: refreshToken,
    scope: "api offline_access",
    token_type: "Bearer",
    MasterPasswordPolicy: masterPasswordPolicyResponse,
    UserDecryptionOptions: userDecryptionOptions || defaultUserDecryptionOptionsServerResponse,
    AccountKeys: {
      publicKeyEncryptionKeyPair: {
        wrappedPrivateKey: privateKey,
        publicKey: "PUBLIC_KEY",
      },
    },
  });
}
