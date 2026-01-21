import { MockProxy, mock } from "jest-mock-extended";

import { AccountApiService } from "@bitwarden/common/auth/abstractions/account-api.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { MasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import {
  MasterPasswordAuthenticationData,
  MasterPasswordAuthenticationHash,
  MasterPasswordUnlockData,
  MasterPasswordSalt,
  MasterKeyWrappedUserKey,
} from "@bitwarden/common/key-management/master-password/types/master-password.types";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { CsprngArray } from "@bitwarden/common/types/csprng";
import { MasterKey, UserKey } from "@bitwarden/common/types/key";
import { DEFAULT_KDF_CONFIG, KeyService } from "@bitwarden/key-management";

import { PasswordInputResult } from "../../input-password/password-input-result";

import { DefaultRegistrationFinishService } from "./default-registration-finish.service";

describe("DefaultRegistrationFinishService", () => {
  let service: DefaultRegistrationFinishService;

  let keyService: MockProxy<KeyService>;
  let accountApiService: MockProxy<AccountApiService>;
  let masterPasswordService: MockProxy<MasterPasswordServiceAbstraction>;

  beforeEach(() => {
    keyService = mock<KeyService>();
    accountApiService = mock<AccountApiService>();
    masterPasswordService = mock<MasterPasswordServiceAbstraction>();

    service = new DefaultRegistrationFinishService(
      keyService,
      accountApiService,
      masterPasswordService,
    );
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

  describe("getOrgNameFromOrgInvite()", () => {
    it("returns null", async () => {
      const result = await service.getOrgNameFromOrgInvite();

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

    beforeEach(() => {
      email = "test@email.com";
      emailVerificationToken = "emailVerificationToken";
      masterKey = new SymmetricCryptoKey(new Uint8Array(64).buffer as CsprngArray) as MasterKey;
      passwordInputResult = {
        newMasterKey: masterKey,
        newServerMasterKeyHash: "newServerMasterKeyHash",
        newLocalMasterKeyHash: "newLocalMasterKeyHash",
        kdfConfig: DEFAULT_KDF_CONFIG,
        newPasswordHint: "newPasswordHint",
        newPassword: "newPassword",
      };

      userKey = new SymmetricCryptoKey(new Uint8Array(64).buffer as CsprngArray) as UserKey;
      userKeyEncString = new EncString("userKeyEncrypted");

      userKeyPair = ["publicKey", new EncString("privateKey")];
    });

    it("throws an error if the user key cannot be created", async () => {
      keyService.makeUserKey.mockResolvedValue([null, null]);
      masterPasswordService.emailToSalt.mockReturnValue("salt" as MasterPasswordSalt);

      await expect(service.finishRegistration(email, passwordInputResult)).rejects.toThrow(
        "User key could not be created",
      );
    });

    it("registers the user when given valid email verification input", async () => {
      keyService.makeUserKey.mockResolvedValue([userKey, userKeyEncString]);
      keyService.makeKeyPair.mockResolvedValue(userKeyPair);
      accountApiService.registerFinish.mockResolvedValue();
      const salt = "salt" as MasterPasswordSalt;
      const masterPasswordAuthentication: MasterPasswordAuthenticationData = {
        salt,
        kdf: DEFAULT_KDF_CONFIG,
        masterPasswordAuthenticationHash: "authHash" as MasterPasswordAuthenticationHash,
      };
      const masterPasswordUnlock = new MasterPasswordUnlockData(
        salt,
        DEFAULT_KDF_CONFIG,
        "wrappedUserKey" as MasterKeyWrappedUserKey,
      );
      masterPasswordService.emailToSalt.mockReturnValue(salt);
      masterPasswordService.makeMasterPasswordAuthenticationData.mockResolvedValue(
        masterPasswordAuthentication,
      );
      masterPasswordService.makeMasterPasswordUnlockData.mockResolvedValue(masterPasswordUnlock);

      await service.finishRegistration(email, passwordInputResult, emailVerificationToken);

      expect(keyService.makeUserKey).toHaveBeenCalledWith(masterKey);
      expect(keyService.makeKeyPair).toHaveBeenCalledWith(userKey);
      expect(accountApiService.registerFinish).toHaveBeenCalledWith(
        expect.objectContaining({
          email,
          emailVerificationToken: emailVerificationToken,
          masterPasswordHash: passwordInputResult.newServerMasterKeyHash,
          masterPasswordHint: passwordInputResult.newPasswordHint,
          userSymmetricKey: userKeyEncString.encryptedString,
          userAsymmetricKeys: {
            publicKey: userKeyPair[0],
            encryptedPrivateKey: userKeyPair[1].encryptedString,
          },
          masterPasswordAuthentication: masterPasswordAuthentication,
          masterPasswordUnlock: masterPasswordUnlock,
          // Web only fields should be undefined
          orgInviteToken: undefined,
          organizationUserId: undefined,
          orgSponsoredFreeFamilyPlanToken: undefined,
          acceptEmergencyAccessInviteToken: undefined,
          acceptEmergencyAccessId: undefined,
          providerInviteToken: undefined,
          providerUserId: undefined,
        }),
      );
    });
  });
});
