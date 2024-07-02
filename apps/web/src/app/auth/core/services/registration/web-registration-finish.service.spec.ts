import { MockProxy, mock } from "jest-mock-extended";
import { of } from "rxjs";

import { PasswordInputResult } from "@bitwarden/auth/angular";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { AccountApiService } from "@bitwarden/common/auth/abstractions/account-api.service";
import { DEFAULT_KDF_CONFIG } from "@bitwarden/common/auth/models/domain/kdf-config";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { CsprngArray } from "@bitwarden/common/types/csprng";
import { MasterKey, UserKey } from "@bitwarden/common/types/key";

import { AcceptOrganizationInviteService } from "../../../organization-invite/accept-organization.service";
import { OrganizationInvite } from "../../../organization-invite/organization-invite";

import { WebRegistrationFinishService } from "./web-registration-finish.service";

describe("DefaultRegistrationFinishService", () => {
  let service: WebRegistrationFinishService;

  let cryptoService: MockProxy<CryptoService>;
  let accountApiService: MockProxy<AccountApiService>;
  let acceptOrgInviteService: MockProxy<AcceptOrganizationInviteService>;
  let policyApiService: MockProxy<PolicyApiServiceAbstraction>;
  let logService: MockProxy<LogService>;
  let policyService: MockProxy<PolicyService>;

  beforeEach(() => {
    cryptoService = mock<CryptoService>();
    accountApiService = mock<AccountApiService>();
    acceptOrgInviteService = mock<AcceptOrganizationInviteService>();
    policyApiService = mock<PolicyApiServiceAbstraction>();
    logService = mock<LogService>();
    policyService = mock<PolicyService>();

    service = new WebRegistrationFinishService(
      cryptoService,
      accountApiService,
      acceptOrgInviteService,
      policyApiService,
      logService,
      policyService,
    );
  });

  it("instantiates", () => {
    expect(service).not.toBeFalsy();
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
      acceptOrgInviteService.getOrganizationInvite.mockResolvedValue(null);

      const result = await service.getMasterPasswordPolicyOptsFromOrgInvite();

      expect(result).toBeNull();
      expect(acceptOrgInviteService.getOrganizationInvite).toHaveBeenCalled();
    });

    it("returns null when the policies are null", async () => {
      acceptOrgInviteService.getOrganizationInvite.mockResolvedValue(orgInvite);
      policyApiService.getPoliciesByToken.mockResolvedValue(null);

      const result = await service.getMasterPasswordPolicyOptsFromOrgInvite();

      expect(result).toBeNull();
      expect(acceptOrgInviteService.getOrganizationInvite).toHaveBeenCalled();
      expect(policyApiService.getPoliciesByToken).toHaveBeenCalledWith(
        orgInvite.organizationId,
        orgInvite.token,
        orgInvite.email,
        orgInvite.organizationUserId,
      );
    });

    it("logs an error and returns null when policies cannot be fetched", async () => {
      acceptOrgInviteService.getOrganizationInvite.mockResolvedValue(orgInvite);
      policyApiService.getPoliciesByToken.mockRejectedValue(new Error("error"));

      const result = await service.getMasterPasswordPolicyOptsFromOrgInvite();

      expect(result).toBeNull();
      expect(acceptOrgInviteService.getOrganizationInvite).toHaveBeenCalled();
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

      acceptOrgInviteService.getOrganizationInvite.mockResolvedValue(orgInvite);
      policyApiService.getPoliciesByToken.mockResolvedValue(masterPasswordPolicies);
      policyService.masterPasswordPolicyOptions$.mockReturnValue(of(masterPasswordPolicyOptions));

      const result = await service.getMasterPasswordPolicyOptsFromOrgInvite();

      expect(result).toEqual(masterPasswordPolicyOptions);
      expect(acceptOrgInviteService.getOrganizationInvite).toHaveBeenCalled();
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
    let capchaBypassToken: string;

    let orgInvite: OrganizationInvite;

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

      orgInvite = new OrganizationInvite();
      orgInvite.organizationUserId = "organizationUserId";
      orgInvite.token = "orgInviteToken";
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
      acceptOrgInviteService.getOrganizationInvite.mockResolvedValue(null);

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
          orgInviteToken: undefined,
          organizationUserId: undefined,
        }),
      );
    });

    it("it registers the user and returns a captcha bypass token when given an org invite", async () => {
      cryptoService.makeUserKey.mockResolvedValue([userKey, userKeyEncString]);
      cryptoService.makeKeyPair.mockResolvedValue(userKeyPair);
      accountApiService.registerFinish.mockResolvedValue(capchaBypassToken);
      acceptOrgInviteService.getOrganizationInvite.mockResolvedValue(orgInvite);

      const result = await service.finishRegistration(email, passwordInputResult);

      expect(result).toEqual(capchaBypassToken);

      expect(cryptoService.makeUserKey).toHaveBeenCalledWith(masterKey);
      expect(cryptoService.makeKeyPair).toHaveBeenCalledWith(userKey);
      expect(accountApiService.registerFinish).toHaveBeenCalledWith(
        expect.objectContaining({
          email,
          emailVerificationToken: undefined,
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
          orgInviteToken: orgInvite.token,
          organizationUserId: orgInvite.organizationUserId,
        }),
      );
    });
  });
});
