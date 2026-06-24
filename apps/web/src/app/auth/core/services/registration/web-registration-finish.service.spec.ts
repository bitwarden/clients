import { MockProxy, mock } from "jest-mock-extended";
import { of } from "rxjs";

import { PasswordInputResult } from "@bitwarden/auth/angular";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { AccountApiService } from "@bitwarden/common/auth/abstractions/account-api.service";
import { RegisterFinishRequest } from "@bitwarden/common/auth/models/request/registration/register-finish.request";
import { OrganizationInvite } from "@bitwarden/common/auth/organization-invite/organization-invite";
import { OrganizationInviteService } from "@bitwarden/common/auth/organization-invite/organization-invite.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { MasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import {
  MasterPasswordUnlockData,
  MasterPasswordSalt,
  MasterPasswordAuthenticationData,
  MasterPasswordAuthenticationHash,
  MasterKeyWrappedUserKey,
} from "@bitwarden/common/key-management/master-password/types/master-password.types";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { MasterKey, UserKey } from "@bitwarden/common/types/key";
import { DEFAULT_KDF_CONFIG, KeyService } from "@bitwarden/key-management";

import { WebRegistrationFinishService } from "./web-registration-finish.service";

describe("WebRegistrationFinishService", () => {
  let service: WebRegistrationFinishService;

  let keyService: MockProxy<KeyService>;
  let accountApiService: MockProxy<AccountApiService>;
  let organizationInviteService: MockProxy<OrganizationInviteService>;
  let policyService: MockProxy<PolicyService>;
  let masterPasswordService: MockProxy<MasterPasswordServiceAbstraction>;

  beforeEach(() => {
    keyService = mock<KeyService>();
    accountApiService = mock<AccountApiService>();
    organizationInviteService = mock<OrganizationInviteService>();
    policyService = mock<PolicyService>();
    masterPasswordService = mock<MasterPasswordServiceAbstraction>();

    service = new WebRegistrationFinishService(
      keyService,
      accountApiService,
      masterPasswordService,
      organizationInviteService,
      policyService,
    );
  });

  it("instantiates", () => {
    expect(service).not.toBeFalsy();
  });

  describe("getOrgNameFromOrgInvite()", () => {
    let orgInvite: OrganizationInvite | null;

    beforeEach(() => {
      orgInvite = new OrganizationInvite({
        organizationId: "organizationId",
        organizationUserId: "organizationUserId",
        token: "orgInviteToken",
        email: "email",
        organizationName: "organizationName",
        initOrganization: false,
        orgUserHasExistingUser: false,
      });
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
      orgInvite = new OrganizationInvite({
        organizationId: "organizationId",
        organizationUserId: "organizationUserId",
        token: "orgInviteToken",
        email: "email",
        organizationName: "organizationName",
        initOrganization: false,
        orgUserHasExistingUser: false,
      });
    });

    it("returns null when the org invite is null", async () => {
      organizationInviteService.getOrganizationInvite.mockResolvedValue(null);

      const result = await service.getMasterPasswordPolicyOptsFromOrgInvite();

      expect(result).toBeNull();
      expect(organizationInviteService.getOrganizationInvite).toHaveBeenCalled();
    });

    it("returns null when the policies are undefined", async () => {
      organizationInviteService.getOrganizationInvite.mockResolvedValue(orgInvite);
      organizationInviteService.getInvitePolicies.mockResolvedValue(undefined);

      const result = await service.getMasterPasswordPolicyOptsFromOrgInvite();

      expect(result).toBeNull();
      expect(organizationInviteService.getOrganizationInvite).toHaveBeenCalled();
      expect(organizationInviteService.getInvitePolicies).toHaveBeenCalledWith(orgInvite);
    });

    it("returns the master password policy options from the organization invite when it exists", async () => {
      const masterPasswordPolicies = [new Policy()];
      const masterPasswordPolicyOptions = new MasterPasswordPolicyOptions();

      organizationInviteService.getOrganizationInvite.mockResolvedValue(orgInvite);
      organizationInviteService.getInvitePolicies.mockResolvedValue(masterPasswordPolicies);
      policyService.masterPasswordPolicyOptions$.mockReturnValue(of(masterPasswordPolicyOptions));

      const result = await service.getMasterPasswordPolicyOptsFromOrgInvite();

      expect(result).toEqual(masterPasswordPolicyOptions);
      expect(organizationInviteService.getOrganizationInvite).toHaveBeenCalled();
      expect(organizationInviteService.getInvitePolicies).toHaveBeenCalledWith(orgInvite);
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
    let masterPasswordAuthentication: MasterPasswordAuthenticationData;
    let masterPasswordUnlock: MasterPasswordUnlockData;

    beforeEach(() => {
      email = "test@email.com";
      emailVerificationToken = "emailVerificationToken";
      masterKey = new SymmetricCryptoKey(new Uint8Array(64)) as MasterKey;
      salt = "salt" as MasterPasswordSalt;

      passwordInputResult = {
        newPassword: "newPassword",
        kdfConfig: DEFAULT_KDF_CONFIG,
        newPasswordHint: "newPasswordHint",
        salt: salt,
      };

      userKey = new SymmetricCryptoKey(new Uint8Array(64)) as UserKey;
      userKeyEncString = new EncString("userKeyEncrypted");
      userKeyPair = ["publicKey", new EncString("privateKey")];

      orgInvite = new OrganizationInvite({
        organizationId: "organizationId",
        organizationUserId: "organizationUserId",
        token: "orgInviteToken",
        email: "email",
        organizationName: "organizationName",
        initOrganization: false,
        orgUserHasExistingUser: false,
      });

      orgSponsoredFreeFamilyPlanToken = "orgSponsoredFreeFamilyPlanToken";
      acceptEmergencyAccessInviteToken = "acceptEmergencyAccessInviteToken";
      emergencyAccessId = "emergencyAccessId";
      providerInviteToken = "providerInviteToken";
      providerUserId = "providerUserId";

      keyService.makeMasterKey.mockResolvedValue(masterKey);
      keyService.makeUserKey.mockResolvedValue([userKey, userKeyEncString]);
      keyService.makeKeyPair.mockResolvedValue(userKeyPair);
      accountApiService.registerFinish.mockResolvedValue();
      organizationInviteService.getOrganizationInvite.mockResolvedValue(null);

      masterPasswordAuthentication = {
        salt,
        kdf: DEFAULT_KDF_CONFIG,
        masterPasswordAuthenticationHash: "authHash" as MasterPasswordAuthenticationHash,
      };
      masterPasswordUnlock = new MasterPasswordUnlockData(
        salt,
        DEFAULT_KDF_CONFIG,
        "masterKeyWrappedUserKey" as MasterKeyWrappedUserKey,
      );
      masterPasswordService.makeMasterPasswordAuthenticationData.mockResolvedValue(
        masterPasswordAuthentication,
      );
      masterPasswordService.makeMasterPasswordUnlockData.mockResolvedValue(masterPasswordUnlock);
    });

    it("throws an error if the user key cannot be created", async () => {
      keyService.makeUserKey.mockResolvedValue([null, null]);

      await expect(service.finishRegistration(email, passwordInputResult)).rejects.toThrow(
        "User key could not be created",
      );
    });

    it("derives the master key and registers the user", async () => {
      await service.finishRegistration(email, passwordInputResult, emailVerificationToken);

      // Verify master key is derived internally
      expect(keyService.makeMasterKey).toHaveBeenCalledWith(
        passwordInputResult.newPassword,
        passwordInputResult.salt,
        passwordInputResult.kdfConfig,
      );
      expect(keyService.makeUserKey).toHaveBeenCalledWith(masterKey);
      expect(keyService.makeKeyPair).toHaveBeenCalledWith(userKey);

      const registerCall = accountApiService.registerFinish.mock
        .calls[0][0] as RegisterFinishRequest;
      expect(registerCall).toBeInstanceOf(RegisterFinishRequest);

      expect(registerCall.masterPasswordAuthentication).toBeDefined();
      expect(registerCall.masterPasswordUnlock).toBeDefined();

      // Unique to this flow: emailVerificationToken is populated
      expect(registerCall.emailVerificationToken).toEqual(emailVerificationToken);

      expect(registerCall).toMatchSnapshot();
    });

    it("it registers the user with org invite when given an org invite", async () => {
      organizationInviteService.getOrganizationInvite.mockResolvedValue(orgInvite);

      await service.finishRegistration(email, passwordInputResult);

      expect(keyService.makeUserKey).toHaveBeenCalledWith(masterKey);
      expect(keyService.makeKeyPair).toHaveBeenCalledWith(userKey);

      const registerCall = accountApiService.registerFinish.mock
        .calls[0][0] as RegisterFinishRequest;
      expect(registerCall).toBeInstanceOf(RegisterFinishRequest);
      expect(registerCall.masterPasswordAuthentication).toBeDefined();
      expect(registerCall.masterPasswordUnlock).toBeDefined();

      // Unique to this flow: org invite fields are populated
      expect(registerCall.orgInviteToken).toEqual(orgInvite.token);
      expect(registerCall.organizationUserId).toEqual(orgInvite.organizationUserId);

      expect(registerCall).toMatchSnapshot();
    });

    it("registers the user when given an org sponsored free family plan token", async () => {
      await service.finishRegistration(
        email,
        passwordInputResult,
        undefined,
        orgSponsoredFreeFamilyPlanToken,
      );

      expect(keyService.makeUserKey).toHaveBeenCalledWith(masterKey);
      expect(keyService.makeKeyPair).toHaveBeenCalledWith(userKey);

      const registerCall = accountApiService.registerFinish.mock
        .calls[0][0] as RegisterFinishRequest;
      expect(registerCall).toBeInstanceOf(RegisterFinishRequest);
      expect(registerCall.masterPasswordAuthentication).toBeDefined();
      expect(registerCall.masterPasswordUnlock).toBeDefined();

      // Unique to this flow: org sponsored free family plan token is populated
      expect(registerCall.orgSponsoredFreeFamilyPlanToken).toEqual(orgSponsoredFreeFamilyPlanToken);

      expect(registerCall).toMatchSnapshot();
    });

    it("registers the user when given an emergency access invite token", async () => {
      await service.finishRegistration(
        email,
        passwordInputResult,
        undefined,
        undefined,
        acceptEmergencyAccessInviteToken,
        emergencyAccessId,
      );

      expect(keyService.makeUserKey).toHaveBeenCalledWith(masterKey);
      expect(keyService.makeKeyPair).toHaveBeenCalledWith(userKey);

      const registerCall = accountApiService.registerFinish.mock
        .calls[0][0] as RegisterFinishRequest;
      expect(registerCall).toBeInstanceOf(RegisterFinishRequest);
      expect(registerCall.masterPasswordAuthentication).toBeDefined();
      expect(registerCall.masterPasswordUnlock).toBeDefined();

      // Unique to this flow: emergency access fields are populated
      expect(registerCall.acceptEmergencyAccessInviteToken).toEqual(
        acceptEmergencyAccessInviteToken,
      );
      expect(registerCall.acceptEmergencyAccessId).toEqual(emergencyAccessId);

      expect(registerCall).toMatchSnapshot();
    });

    it("registers the user when given a provider invite token", async () => {
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

      expect(keyService.makeUserKey).toHaveBeenCalledWith(masterKey);
      expect(keyService.makeKeyPair).toHaveBeenCalledWith(userKey);

      const registerCall = accountApiService.registerFinish.mock
        .calls[0][0] as RegisterFinishRequest;
      expect(registerCall).toBeInstanceOf(RegisterFinishRequest);
      expect(registerCall.masterPasswordAuthentication).toBeDefined();
      expect(registerCall.masterPasswordUnlock).toBeDefined();

      // Unique to this flow: provider invite fields are populated
      expect(registerCall.providerInviteToken).toEqual(providerInviteToken);
      expect(registerCall.providerUserId).toEqual(providerUserId);

      expect(registerCall).toMatchSnapshot();
    });
  });
});
