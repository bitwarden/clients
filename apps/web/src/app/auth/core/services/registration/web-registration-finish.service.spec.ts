// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { MockProxy, mock } from "jest-mock-extended";
import { of } from "rxjs";

import { PasswordInputResult } from "@bitwarden/auth/angular";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { AccountApiService } from "@bitwarden/common/auth/abstractions/account-api.service";
import { RegisterFinishV2Request } from "@bitwarden/common/auth/models/request/registration/register-finish-v2.request";
import { RegisterFinishRequest } from "@bitwarden/common/auth/models/request/registration/register-finish.request";
import { OrganizationInvite } from "@bitwarden/common/auth/services/organization-invite/organization-invite";
import { OrganizationInviteService } from "@bitwarden/common/auth/services/organization-invite/organization-invite.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { MasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import {
  MasterPasswordUnlockData,
  MasterPasswordSalt,
} from "@bitwarden/common/key-management/master-password/types/master-password.types";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { CsprngArray } from "@bitwarden/common/types/csprng";
import { MasterKey, UserKey } from "@bitwarden/common/types/key";
import { DEFAULT_KDF_CONFIG, KeyService, KdfType } from "@bitwarden/key-management";

import { WebRegistrationFinishService } from "./web-registration-finish.service";

describe("WebRegistrationFinishService", () => {
  let service: WebRegistrationFinishService;

  let keyService: MockProxy<KeyService>;
  let accountApiService: MockProxy<AccountApiService>;
  let organizationInviteService: MockProxy<OrganizationInviteService>;
  let policyApiService: MockProxy<PolicyApiServiceAbstraction>;
  let logService: MockProxy<LogService>;
  let policyService: MockProxy<PolicyService>;
  let masterPasswordService: MockProxy<MasterPasswordServiceAbstraction>;
  let configService: MockProxy<ConfigService>;

  beforeEach(() => {
    keyService = mock<KeyService>();
    accountApiService = mock<AccountApiService>();
    organizationInviteService = mock<OrganizationInviteService>();
    policyApiService = mock<PolicyApiServiceAbstraction>();
    logService = mock<LogService>();
    policyService = mock<PolicyService>();
    masterPasswordService = mock<MasterPasswordServiceAbstraction>();
    configService = mock<ConfigService>();

    service = new WebRegistrationFinishService(
      keyService,
      accountApiService,
      masterPasswordService,
      configService,
      organizationInviteService,
      policyApiService,
      logService,
      policyService,
    );
  });

  it("instantiates", () => {
    expect(service).not.toBeFalsy();
  });

  describe("getOrgNameFromOrgInvite()", () => {
    let orgInvite: OrganizationInvite | null;

    beforeEach(() => {
      orgInvite = new OrganizationInvite();
      orgInvite.organizationId = "organizationId";
      orgInvite.organizationUserId = "organizationUserId";
      orgInvite.token = "orgInviteToken";
      orgInvite.email = "email";
    });

    it("returns null when the org invite is null", async () => {
      organizationInviteService.getOrganizationInvite.mockResolvedValue(null);

      const result = await service.getOrgNameFromOrgInvite();

      expect(result).toBeNull();
      expect(organizationInviteService.getOrganizationInvite).toHaveBeenCalled();
    });

    it("returns the organization name from the organization invite when it exists", async () => {
      organizationInviteService.getOrganizationInvite.mockResolvedValue(orgInvite);

      const result = await service.getOrgNameFromOrgInvite();

      expect(result).toEqual(orgInvite.organizationName);
      expect(organizationInviteService.getOrganizationInvite).toHaveBeenCalled();
    });
  });

  describe("getMasterPasswordPolicyOptsFromOrgInvite()", () => {
    let orgInvite: OrganizationInvite | null;

    beforeEach(() => {
      orgInvite = new OrganizationInvite();
      orgInvite.organizationId = "organizationId";
      orgInvite.organizationUserId = "organizationUserId";
      orgInvite.token = "orgInviteToken";
      orgInvite.email = "email";
    });

    it("returns null when the org invite is null", async () => {
      organizationInviteService.getOrganizationInvite.mockResolvedValue(null);

      const result = await service.getMasterPasswordPolicyOptsFromOrgInvite();

      expect(result).toBeNull();
      expect(organizationInviteService.getOrganizationInvite).toHaveBeenCalled();
    });

    it("returns null when the policies are null", async () => {
      organizationInviteService.getOrganizationInvite.mockResolvedValue(orgInvite);
      policyApiService.getPoliciesByToken.mockResolvedValue(null);

      const result = await service.getMasterPasswordPolicyOptsFromOrgInvite();

      expect(result).toBeNull();
      expect(organizationInviteService.getOrganizationInvite).toHaveBeenCalled();
      expect(policyApiService.getPoliciesByToken).toHaveBeenCalledWith(
        orgInvite.organizationId,
        orgInvite.token,
        orgInvite.email,
        orgInvite.organizationUserId,
      );
    });

    it("logs an error and returns null when policies cannot be fetched", async () => {
      organizationInviteService.getOrganizationInvite.mockResolvedValue(orgInvite);
      policyApiService.getPoliciesByToken.mockRejectedValue(new Error("error"));

      const result = await service.getMasterPasswordPolicyOptsFromOrgInvite();

      expect(result).toBeNull();
      expect(organizationInviteService.getOrganizationInvite).toHaveBeenCalled();
      expect(policyApiService.getPoliciesByToken).toHaveBeenCalledWith(
        orgInvite.organizationId,
        orgInvite.token,
        orgInvite.email,
        orgInvite.organizationUserId,
      );
      expect(logService.error).toHaveBeenCalled();
    });

    it("returns the master password policy options from the organization invite when it exists", async () => {
      const masterPasswordPolicies = [new Policy()];
      const masterPasswordPolicyOptions = new MasterPasswordPolicyOptions();

      organizationInviteService.getOrganizationInvite.mockResolvedValue(orgInvite);
      policyApiService.getPoliciesByToken.mockResolvedValue(masterPasswordPolicies);
      policyService.masterPasswordPolicyOptions$.mockReturnValue(of(masterPasswordPolicyOptions));

      const result = await service.getMasterPasswordPolicyOptsFromOrgInvite();

      expect(result).toEqual(masterPasswordPolicyOptions);
      expect(organizationInviteService.getOrganizationInvite).toHaveBeenCalled();
      expect(policyApiService.getPoliciesByToken).toHaveBeenCalledWith(
        orgInvite.organizationId,
        orgInvite.token,
        orgInvite.email,
        orgInvite.organizationUserId,
      );
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

    let orgInvite: OrganizationInvite;
    let orgSponsoredFreeFamilyPlanToken: string;
    let acceptEmergencyAccessInviteToken: string;
    let emergencyAccessId: string;
    let providerInviteToken: string;
    let providerUserId: string;

    let salt: MasterPasswordSalt;
    let masterPasswordAuthentication: any;
    let masterPasswordUnlock: MasterPasswordUnlockData;

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

      orgInvite = new OrganizationInvite();
      orgInvite.organizationUserId = "organizationUserId";
      orgInvite.token = "orgInviteToken";

      orgSponsoredFreeFamilyPlanToken = "orgSponsoredFreeFamilyPlanToken";
      acceptEmergencyAccessInviteToken = "acceptEmergencyAccessInviteToken";
      emergencyAccessId = "emergencyAccessId";
      providerInviteToken = "providerInviteToken";
      providerUserId = "providerUserId";

      salt = "salt" as MasterPasswordSalt;
      masterPasswordAuthentication = {
        salt,
        kdf: DEFAULT_KDF_CONFIG,
        masterPasswordAuthenticationHash: "authHash" as string,
      };
      masterPasswordUnlock = new MasterPasswordUnlockData(
        salt,
        DEFAULT_KDF_CONFIG,
        new EncString("wrapped") as any,
      );
    });

    it("throws an error if the user key cannot be created", async () => {
      keyService.makeUserKey.mockResolvedValue([null, null]);
      configService.getFeatureFlag.mockResolvedValue(false);

      await expect(service.finishRegistration(email, passwordInputResult)).rejects.toThrow(
        "User key could not be created",
      );
    });

    describe("when feature flag is OFF (old API)", () => {
      beforeEach(() => {
        configService.getFeatureFlag.mockResolvedValue(false);
      });

      it("registers the user with KDF fields when given valid email verification input", async () => {
        keyService.makeUserKey.mockResolvedValue([userKey, userKeyEncString]);
        keyService.makeKeyPair.mockResolvedValue(userKeyPair);
        accountApiService.registerFinish.mockResolvedValue();
        organizationInviteService.getOrganizationInvite.mockResolvedValue(null);

        await service.finishRegistration(email, passwordInputResult, emailVerificationToken);

        expect(keyService.makeUserKey).toHaveBeenCalledWith(masterKey);
        expect(keyService.makeKeyPair).toHaveBeenCalledWith(userKey);
        expect(configService.getFeatureFlag).toHaveBeenCalledWith(
          FeatureFlag.PM27044_UpdateRegistrationApis,
        );
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
            kdf: KdfType.PBKDF2_SHA256,
            kdfIterations: DEFAULT_KDF_CONFIG.iterations,
          }),
        );

        // Verify old API fields are present
        const registerCall = accountApiService.registerFinish.mock.calls[0][0];
        expect(registerCall).toBeInstanceOf(RegisterFinishRequest);
        expect((registerCall as RegisterFinishRequest).kdf).toBeDefined();
        expect((registerCall as RegisterFinishRequest).kdfIterations).toBeDefined();
      });

      it("it registers the user with org invite when given an org invite", async () => {
        keyService.makeUserKey.mockResolvedValue([userKey, userKeyEncString]);
        keyService.makeKeyPair.mockResolvedValue(userKeyPair);
        accountApiService.registerFinish.mockResolvedValue();
        organizationInviteService.getOrganizationInvite.mockResolvedValue(orgInvite);

        await service.finishRegistration(email, passwordInputResult);

        expect(accountApiService.registerFinish).toHaveBeenCalledWith(
          expect.objectContaining({
            email,
            orgInviteToken: orgInvite.token,
            organizationUserId: orgInvite.organizationUserId,
            kdf: KdfType.PBKDF2_SHA256,
            kdfIterations: DEFAULT_KDF_CONFIG.iterations,
          }),
        );
      });

      it("registers the user when given an org sponsored free family plan token", async () => {
        keyService.makeUserKey.mockResolvedValue([userKey, userKeyEncString]);
        keyService.makeKeyPair.mockResolvedValue(userKeyPair);
        accountApiService.registerFinish.mockResolvedValue();
        organizationInviteService.getOrganizationInvite.mockResolvedValue(null);

        await service.finishRegistration(
          email,
          passwordInputResult,
          undefined,
          orgSponsoredFreeFamilyPlanToken,
        );

        expect(accountApiService.registerFinish).toHaveBeenCalledWith(
          expect.objectContaining({
            email,
            orgSponsoredFreeFamilyPlanToken: orgSponsoredFreeFamilyPlanToken,
          }),
        );
      });

      it("registers the user when given an emergency access invite token", async () => {
        keyService.makeUserKey.mockResolvedValue([userKey, userKeyEncString]);
        keyService.makeKeyPair.mockResolvedValue(userKeyPair);
        accountApiService.registerFinish.mockResolvedValue();
        organizationInviteService.getOrganizationInvite.mockResolvedValue(null);

        await service.finishRegistration(
          email,
          passwordInputResult,
          undefined,
          undefined,
          acceptEmergencyAccessInviteToken,
          emergencyAccessId,
        );

        expect(accountApiService.registerFinish).toHaveBeenCalledWith(
          expect.objectContaining({
            email,
            acceptEmergencyAccessInviteToken: acceptEmergencyAccessInviteToken,
            acceptEmergencyAccessId: emergencyAccessId,
          }),
        );
      });

      it("registers the user when given a provider invite token", async () => {
        keyService.makeUserKey.mockResolvedValue([userKey, userKeyEncString]);
        keyService.makeKeyPair.mockResolvedValue(userKeyPair);
        accountApiService.registerFinish.mockResolvedValue();
        organizationInviteService.getOrganizationInvite.mockResolvedValue(null);

        await service.finishRegistration(
          email,
          passwordInputResult,
          undefined,
          undefined,
          undefined,
          undefined,
          providerInviteToken,
          providerUserId,
        );

        expect(accountApiService.registerFinish).toHaveBeenCalledWith(
          expect.objectContaining({
            email,
            providerInviteToken: providerInviteToken,
            providerUserId: providerUserId,
          }),
        );
      });
    });

    describe("when feature flag is ON (new API)", () => {
      beforeEach(() => {
        configService.getFeatureFlag.mockResolvedValue(true);
        masterPasswordService.emailToSalt.mockReturnValue(salt);
        masterPasswordService.makeMasterPasswordAuthenticationData.mockResolvedValue(
          masterPasswordAuthentication,
        );
        masterPasswordService.makeMasterPasswordUnlockData.mockResolvedValue(masterPasswordUnlock);
      });

      it("registers the user with new data types when given valid email verification input", async () => {
        keyService.makeUserKey.mockResolvedValue([userKey, userKeyEncString]);
        keyService.makeKeyPair.mockResolvedValue(userKeyPair);
        accountApiService.registerFinish.mockResolvedValue();
        organizationInviteService.getOrganizationInvite.mockResolvedValue(null);

        await service.finishRegistration(email, passwordInputResult, emailVerificationToken);

        expect(keyService.makeUserKey).toHaveBeenCalledWith(masterKey);
        expect(keyService.makeKeyPair).toHaveBeenCalledWith(userKey);
        expect(configService.getFeatureFlag).toHaveBeenCalledWith(
          FeatureFlag.PM27044_UpdateRegistrationApis,
        );
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
          }),
        );

        // Verify new API fields are present
        const registerCall = accountApiService.registerFinish.mock.calls[0][0];
        expect(registerCall).toBeInstanceOf(RegisterFinishV2Request);
        expect(
          (registerCall as RegisterFinishV2Request).masterPasswordAuthentication,
        ).toBeDefined();
        expect((registerCall as RegisterFinishV2Request).masterPasswordUnlock).toBeDefined();

        // Verify old API fields are NOT present
        expect((registerCall as any).kdf).toBeUndefined();
        expect((registerCall as any).kdfIterations).toBeUndefined();
      });

      it("it registers the user with org invite when given an org invite", async () => {
        keyService.makeUserKey.mockResolvedValue([userKey, userKeyEncString]);
        keyService.makeKeyPair.mockResolvedValue(userKeyPair);
        accountApiService.registerFinish.mockResolvedValue();
        organizationInviteService.getOrganizationInvite.mockResolvedValue(orgInvite);

        await service.finishRegistration(email, passwordInputResult);

        expect(accountApiService.registerFinish).toHaveBeenCalledWith(
          expect.objectContaining({
            email,
            orgInviteToken: orgInvite.token,
            organizationUserId: orgInvite.organizationUserId,
            masterPasswordAuthentication: masterPasswordAuthentication,
            masterPasswordUnlock: masterPasswordUnlock,
          }),
        );

        // Verify new API fields are present
        const registerCall = accountApiService.registerFinish.mock.calls[0][0];
        expect(registerCall).toBeInstanceOf(RegisterFinishV2Request);
      });

      it("registers the user when given an org sponsored free family plan token", async () => {
        keyService.makeUserKey.mockResolvedValue([userKey, userKeyEncString]);
        keyService.makeKeyPair.mockResolvedValue(userKeyPair);
        accountApiService.registerFinish.mockResolvedValue();
        organizationInviteService.getOrganizationInvite.mockResolvedValue(null);

        await service.finishRegistration(
          email,
          passwordInputResult,
          undefined,
          orgSponsoredFreeFamilyPlanToken,
        );

        expect(accountApiService.registerFinish).toHaveBeenCalledWith(
          expect.objectContaining({
            email,
            orgSponsoredFreeFamilyPlanToken: orgSponsoredFreeFamilyPlanToken,
            masterPasswordAuthentication: masterPasswordAuthentication,
            masterPasswordUnlock: masterPasswordUnlock,
          }),
        );
      });

      it("registers the user when given an emergency access invite token", async () => {
        keyService.makeUserKey.mockResolvedValue([userKey, userKeyEncString]);
        keyService.makeKeyPair.mockResolvedValue(userKeyPair);
        accountApiService.registerFinish.mockResolvedValue();
        organizationInviteService.getOrganizationInvite.mockResolvedValue(null);

        await service.finishRegistration(
          email,
          passwordInputResult,
          undefined,
          undefined,
          acceptEmergencyAccessInviteToken,
          emergencyAccessId,
        );

        expect(accountApiService.registerFinish).toHaveBeenCalledWith(
          expect.objectContaining({
            email,
            acceptEmergencyAccessInviteToken: acceptEmergencyAccessInviteToken,
            acceptEmergencyAccessId: emergencyAccessId,
            masterPasswordAuthentication: masterPasswordAuthentication,
            masterPasswordUnlock: masterPasswordUnlock,
          }),
        );
      });

      it("registers the user when given a provider invite token", async () => {
        keyService.makeUserKey.mockResolvedValue([userKey, userKeyEncString]);
        keyService.makeKeyPair.mockResolvedValue(userKeyPair);
        accountApiService.registerFinish.mockResolvedValue();
        organizationInviteService.getOrganizationInvite.mockResolvedValue(null);

        await service.finishRegistration(
          email,
          passwordInputResult,
          undefined,
          undefined,
          undefined,
          undefined,
          providerInviteToken,
          providerUserId,
        );

        expect(accountApiService.registerFinish).toHaveBeenCalledWith(
          expect.objectContaining({
            email,
            providerInviteToken: providerInviteToken,
            providerUserId: providerUserId,
            masterPasswordAuthentication: masterPasswordAuthentication,
            masterPasswordUnlock: masterPasswordUnlock,
          }),
        );
      });
    });
  });
});
