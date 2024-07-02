import { MockProxy, mock } from "jest-mock-extended";

import { AccountApiService } from "@bitwarden/common/auth/abstractions/account-api.service";
import { DEFAULT_KDF_CONFIG } from "@bitwarden/common/auth/models/domain/kdf-config";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { CsprngArray } from "@bitwarden/common/types/csprng";
import { MasterKey, UserKey } from "@bitwarden/common/types/key";

import { PasswordInputResult } from "../../input-password/password-input-result";

import { DefaultRegistrationFinishService } from "./default-registration-finish.service";

describe("DefaultRegistrationFinishService", () => {
  let service: DefaultRegistrationFinishService;

  let cryptoService: MockProxy<CryptoService>;
  let accountApiService: MockProxy<AccountApiService>;

  beforeEach(() => {
    cryptoService = mock<CryptoService>();
    accountApiService = mock<AccountApiService>();

    service = new DefaultRegistrationFinishService(cryptoService, accountApiService);
  });

  it("instantiates", () => {
    expect(service).not.toBeFalsy();
  });

  describe("getMasterPasswordPolicyOptsFromOrgInvite()", () => {
    it("returns null", async () => {
      const result = await service.getMasterPasswordPolicyOptsFromOrgInvite();

      expect(result).toBeNull();
    });
  });

  describe("finishRegistration()", () => {
    let email: string;
    let emailVerificationToken: string;
    let masterKey: MasterKey;
    let passwordInputResult: PasswordInputResult;
    let userKey: UserKey;
    let userKeyEncString: EncString;
    let userKeyPair: [string, EncString];
    let capchaBypassToken: string;

    beforeEach(() => {
      email = "test@email.com";
      emailVerificationToken = "emailVerificationToken";
      masterKey = new SymmetricCryptoKey(new Uint8Array(64).buffer as CsprngArray) as MasterKey;
      passwordInputResult = {
        masterKey: masterKey,
        masterKeyHash: "masterKeyHash",
        kdfConfig: DEFAULT_KDF_CONFIG,
        hint: "hint",
      };

      userKey = new SymmetricCryptoKey(new Uint8Array(64).buffer as CsprngArray) as UserKey;
      userKeyEncString = new EncString("userKeyEncrypted");

      userKeyPair = ["publicKey", new EncString("privateKey")];
      capchaBypassToken = "capchaBypassToken";
    });

    it("throws an error if the user key cannot be created", async () => {
      cryptoService.makeUserKey.mockResolvedValue([null, null]);

      await expect(service.finishRegistration(email, passwordInputResult)).rejects.toThrow(
        "User key could not be created",
      );
    });

    it("registers the user and returns a captcha bypass token when given valid email verification input", async () => {
      cryptoService.makeUserKey.mockResolvedValue([userKey, userKeyEncString]);
      cryptoService.makeKeyPair.mockResolvedValue(userKeyPair);
      accountApiService.registerFinish.mockResolvedValue(capchaBypassToken);

      const result = await service.finishRegistration(
        email,
        passwordInputResult,
        emailVerificationToken,
      );

      expect(result).toEqual(capchaBypassToken);

      expect(cryptoService.makeUserKey).toHaveBeenCalledWith(masterKey);
      expect(cryptoService.makeKeyPair).toHaveBeenCalledWith(userKey);
      expect(accountApiService.registerFinish).toHaveBeenCalledWith(
        expect.objectContaining({
          email,
          emailVerificationToken: emailVerificationToken,
          masterPasswordHash: passwordInputResult.masterKeyHash,
          masterPasswordHint: passwordInputResult.hint,
          userSymmetricKey: userKeyEncString.encryptedString,
          userAsymmetricKeys: {
            publicKey: userKeyPair[0],
            encryptedPrivateKey: userKeyPair[1].encryptedString,
          },
          kdf: passwordInputResult.kdfConfig.kdfType,
          kdfIterations: passwordInputResult.kdfConfig.iterations,
          kdfMemory: undefined,
          kdfParallelism: undefined,
          orgInviteToken: undefined, // OrgInvite only handled in web
          organizationUserId: undefined, // OrgInvite only handled in web
        }),
      );
    });
  });
});
