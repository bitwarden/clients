import { MockProxy, mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { OrganizationUserApiService } from "@bitwarden/admin-console/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { ResetPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/reset-password-policy-options";
import { OrganizationKeysResponse } from "@bitwarden/common/admin-console/models/response/organization-keys.response";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { OrganizationInvite } from "@bitwarden/common/auth/organization-invite/organization-invite";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { FakeGlobalStateProvider } from "@bitwarden/common/spec";
import { OrgKey } from "@bitwarden/common/types/key";
import { newGuid } from "@bitwarden/guid";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { KeyService } from "@bitwarden/key-management";
import { UserId } from "@bitwarden/user-core";

import { DefaultOrganizationInviteService } from "./default-organization-invite.service";

describe("DefaultOrganizationInviteService", () => {
  let sut: DefaultOrganizationInviteService;
  let apiService: MockProxy<ApiService>;
  let authService: MockProxy<AuthService>;
  let keyService: MockProxy<KeyService>;
  let encryptService: MockProxy<EncryptService>;
  let policyApiService: MockProxy<PolicyApiServiceAbstraction>;
  let policyService: MockProxy<PolicyService>;
  let logService: MockProxy<LogService>;
  let organizationApiService: MockProxy<OrganizationApiServiceAbstraction>;
  let organizationUserApiService: MockProxy<OrganizationUserApiService>;
  let i18nService: MockProxy<I18nService>;
  let globalStateProvider: FakeGlobalStateProvider;

  beforeEach(() => {
    apiService = mock();
    authService = mock();
    keyService = mock();
    encryptService = mock();
    policyApiService = mock();
    policyService = mock();
    logService = mock();
    organizationApiService = mock();
    organizationUserApiService = mock();
    i18nService = mock();
    globalStateProvider = new FakeGlobalStateProvider();

    sut = new DefaultOrganizationInviteService(
      apiService,
      authService,
      keyService,
      encryptService,
      policyApiService,
      policyService,
      logService,
      organizationApiService,
      organizationUserApiService,
      i18nService,
      globalStateProvider,
    );
  });

  describe("getOrganizationInvite", () => {
    it("returns null when no invite is stored", async () => {
      const result = await sut.getOrganizationInvite();
      expect(result).toBeNull();
    });

    it("returns the stored invite", async () => {
      const invite = createOrgInvite();
      await sut.setOrganizationInvite(invite);

      const result = await sut.getOrganizationInvite();
      expect(result).toEqual(invite);
    });
  });

  describe("setOrganizationInvite", () => {
    it("stores the provided invite", async () => {
      const invite = createOrgInvite();
      await sut.setOrganizationInvite(invite);

      const stored = await sut.getOrganizationInvite();
      expect(stored).toEqual(invite);
    });
  });

  describe("clearOrganizationInvite", () => {
    it("clears any stored invite", async () => {
      const invite = createOrgInvite();
      await sut.setOrganizationInvite(invite);

      await sut.clearOrganizationInvite();

      const stored = await sut.getOrganizationInvite();
      expect(stored).toBeNull();
    });
  });

  describe("validateAndAcceptInvite", () => {
    const activeUserId = newGuid() as UserId;

    it("initializes an organization when given an invite where initOrganization is true", async () => {
      const mockOrgKey = "orgPrivateKey" as unknown as OrgKey;
      keyService.makeOrgKey.mockResolvedValue([
        { encryptedString: "string" } as EncString,
        mockOrgKey,
      ]);
      keyService.makeKeyPair.mockResolvedValue([
        "orgPublicKey",
        { encryptedString: "string" } as EncString,
      ]);
      encryptService.encryptString.mockResolvedValue({ encryptedString: "string" } as EncString);
      const invite = createOrgInvite({ initOrganization: true });

      const result = await sut.validateAndAcceptInvite(invite, activeUserId);

      expect(result).toBe(true);
      expect(organizationUserApiService.postOrganizationUserAcceptInit).toHaveBeenCalled();
      expect(keyService.makeOrgKey).toHaveBeenCalledWith(activeUserId);
      expect(keyService.makeKeyPair).toHaveBeenCalledWith(mockOrgKey);
      expect(apiService.refreshIdentityToken).toHaveBeenCalled();
      expect(organizationUserApiService.postOrganizationUserAccept).not.toHaveBeenCalled();
      expect(authService.logOut).not.toHaveBeenCalled();
      const stored = await sut.getOrganizationInvite();
      expect(stored).toBeNull();
    });

    it("logs out the user and stores the invite when a master password policy check is required", async () => {
      const invite = createOrgInvite();
      policyApiService.getPoliciesByToken.mockResolvedValue([
        {
          type: PolicyType.MasterPassword,
          enabled: true,
        } as Policy,
      ]);

      const result = await sut.validateAndAcceptInvite(invite, activeUserId);

      expect(result).toBe(false);
      expect(authService.logOut).toHaveBeenCalled();
      const stored = await sut.getOrganizationInvite();
      expect(stored).toEqual(invite);
    });

    it("clears the stored invite when a master password policy check is required but the stored invite doesn't match the provided one", async () => {
      const storedInvite = createOrgInvite({ email: "wrongemail@example.com" });
      const providedInvite = createOrgInvite();
      await sut.setOrganizationInvite(storedInvite);
      policyApiService.getPoliciesByToken.mockResolvedValue([
        {
          type: PolicyType.MasterPassword,
          enabled: true,
        } as Policy,
      ]);

      const result = await sut.validateAndAcceptInvite(providedInvite, activeUserId);

      expect(result).toBe(false);
      expect(authService.logOut).toHaveBeenCalled();
      const stored = await sut.getOrganizationInvite();
      expect(stored).toEqual(providedInvite);
    });

    it("accepts the invite when the organization doesn't have a master password policy", async () => {
      const invite = createOrgInvite();
      policyApiService.getPoliciesByToken.mockResolvedValue([]);

      const result = await sut.validateAndAcceptInvite(invite, activeUserId);

      expect(result).toBe(true);
      expect(organizationUserApiService.postOrganizationUserAccept).toHaveBeenCalled();
      expect(apiService.refreshIdentityToken).toHaveBeenCalled();
      expect(organizationUserApiService.postOrganizationUserAcceptInit).not.toHaveBeenCalled();
      expect(authService.logOut).not.toHaveBeenCalled();
      const stored = await sut.getOrganizationInvite();
      expect(stored).toBeNull();
    });

    it("fetches policies once when accepting an invite with non-MP policies and no stored invite", async () => {
      // Regression: the email-mismatch guard in masterPasswordPolicyCheckRequired
      // ran clearOrganizationInvite when storedInvite was null, wiping the
      // freshly-populated policyCache and forcing resetPasswordEnrollRequired to
      // re-fetch the same policies during the same accept() call.
      const invite = createOrgInvite();
      policyApiService.getPoliciesByToken.mockResolvedValue([
        { type: PolicyType.SingleOrg, enabled: true } as Policy,
      ]);
      policyService.getResetPasswordPolicyOptions.mockReturnValue([
        { autoEnrollEnabled: false } as ResetPasswordPolicyOptions,
        false,
      ]);

      await sut.validateAndAcceptInvite(invite, activeUserId);

      expect(policyApiService.getPoliciesByToken).toHaveBeenCalledTimes(1);
    });

    it("accepts the invite when the org has a master password policy, but the user has already passed it and autoenroll is not enabled", async () => {
      const invite = createOrgInvite();
      // Pre-store the invite to indicate the user has already passed the MP policy check.
      await sut.setOrganizationInvite(invite);
      policyApiService.getPoliciesByToken.mockResolvedValue([
        {
          type: PolicyType.MasterPassword,
          enabled: true,
        } as Policy,
      ]);

      policyService.getResetPasswordPolicyOptions.mockReturnValue([
        {
          autoEnrollEnabled: false,
        } as ResetPasswordPolicyOptions,
        false,
      ]);

      const result = await sut.validateAndAcceptInvite(invite, activeUserId);

      expect(result).toBe(true);
      expect(organizationUserApiService.postOrganizationUserAccept).toHaveBeenCalled();
      expect(organizationUserApiService.postOrganizationUserAcceptInit).not.toHaveBeenCalled();
      const stored = await sut.getOrganizationInvite();
      expect(stored).toBeNull();
      expect(authService.logOut).not.toHaveBeenCalled();
    });

    it("accepts the invite and enrolls when autoenroll is enabled", async () => {
      const invite = createOrgInvite();
      // Pre-store the invite to indicate the user has already passed the MP policy check.
      await sut.setOrganizationInvite(invite);
      policyApiService.getPoliciesByToken.mockResolvedValue([
        {
          type: PolicyType.MasterPassword,
          enabled: true,
        } as Policy,
      ]);
      organizationApiService.getKeys.mockResolvedValue(
        new OrganizationKeysResponse({
          privateKey: "privateKey",
          publicKey: "publicKey",
        }),
      );
      keyService.userKey$.mockReturnValue(new BehaviorSubject({ key: "userKey" } as any));
      encryptService.encapsulateKeyUnsigned.mockResolvedValue({
        encryptedString: "encryptedString",
      } as EncString);

      policyService.getResetPasswordPolicyOptions.mockReturnValue([
        {
          autoEnrollEnabled: true,
        } as ResetPasswordPolicyOptions,
        true,
      ]);

      const result = await sut.validateAndAcceptInvite(invite, activeUserId);

      expect(result).toBe(true);
      expect(encryptService.encapsulateKeyUnsigned).toHaveBeenCalledWith(
        { key: "userKey" },
        Utils.fromB64ToArray("publicKey"),
      );
      expect(organizationUserApiService.postOrganizationUserAccept).toHaveBeenCalled();
      expect(organizationUserApiService.postOrganizationUserAcceptInit).not.toHaveBeenCalled();
      const stored = await sut.getOrganizationInvite();
      expect(stored).toBeNull();
      expect(authService.logOut).not.toHaveBeenCalled();
    });

    describe("acceptAndInitOrganization encryption guards", () => {
      const mockOrgKey = "orgPrivateKey" as unknown as OrgKey;
      let invite: OrganizationInvite;

      beforeEach(() => {
        invite = createOrgInvite({ initOrganization: true });
        keyService.makeOrgKey.mockResolvedValue([
          { encryptedString: "string" } as EncString,
          mockOrgKey,
        ]);
        keyService.makeKeyPair.mockResolvedValue([
          "orgPublicKey",
          { encryptedString: "string" } as EncString,
        ]);
        encryptService.encryptString.mockResolvedValue({ encryptedString: "string" } as EncString);
      });

      it("throws when the encrypted org key has a null encryptedString", async () => {
        keyService.makeOrgKey.mockResolvedValue([
          { encryptedString: null } as unknown as EncString,
          mockOrgKey,
        ]);

        await expect(sut.validateAndAcceptInvite(invite, activeUserId)).rejects.toThrow(
          "Failed to encrypt organization init data.",
        );
        expect(organizationUserApiService.postOrganizationUserAcceptInit).not.toHaveBeenCalled();
      });

      it("throws when the encrypted org private key has a null encryptedString", async () => {
        keyService.makeKeyPair.mockResolvedValue([
          "orgPublicKey",
          { encryptedString: null } as unknown as EncString,
        ]);

        await expect(sut.validateAndAcceptInvite(invite, activeUserId)).rejects.toThrow(
          "Failed to encrypt organization init data.",
        );
        expect(organizationUserApiService.postOrganizationUserAcceptInit).not.toHaveBeenCalled();
      });

      it("throws when the encrypted default collection has a null encryptedString", async () => {
        encryptService.encryptString.mockResolvedValue({
          encryptedString: null,
        } as unknown as EncString);

        await expect(sut.validateAndAcceptInvite(invite, activeUserId)).rejects.toThrow(
          "Failed to encrypt organization init data.",
        );
        expect(organizationUserApiService.postOrganizationUserAcceptInit).not.toHaveBeenCalled();
      });
    });

    describe("reset password enrollment errors", () => {
      let invite: OrganizationInvite;

      beforeEach(async () => {
        invite = createOrgInvite();
        // Pre-store the invite so the MP policy check is bypassed and we reach the accept path.
        await sut.setOrganizationInvite(invite);
        policyApiService.getPoliciesByToken.mockResolvedValue([
          { type: PolicyType.MasterPassword, enabled: true } as Policy,
        ]);
        policyService.getResetPasswordPolicyOptions.mockReturnValue([
          { autoEnrollEnabled: true } as ResetPasswordPolicyOptions,
          true,
        ]);
        organizationApiService.getKeys.mockResolvedValue(
          new OrganizationKeysResponse({ privateKey: "privateKey", publicKey: "publicKey" }),
        );
        keyService.userKey$.mockReturnValue(new BehaviorSubject({ key: "userKey" } as any));
        encryptService.encapsulateKeyUnsigned.mockResolvedValue({
          encryptedString: "encryptedString",
        } as EncString);
      });

      it("throws when organization keys cannot be fetched", async () => {
        organizationApiService.getKeys.mockResolvedValue(null as any);

        await expect(sut.validateAndAcceptInvite(invite, activeUserId)).rejects.toThrow();
        expect(i18nService.t).toHaveBeenCalledWith("resetPasswordOrgKeysError");
        expect(organizationUserApiService.postOrganizationUserAccept).not.toHaveBeenCalled();
      });

      it("throws when the user key is null", async () => {
        keyService.userKey$.mockReturnValue(new BehaviorSubject(null as any));

        await expect(sut.validateAndAcceptInvite(invite, activeUserId)).rejects.toThrow(
          "User key is required to enroll in password reset.",
        );
        expect(organizationUserApiService.postOrganizationUserAccept).not.toHaveBeenCalled();
      });

      it("throws when the encapsulated user key has a null encryptedString", async () => {
        encryptService.encapsulateKeyUnsigned.mockResolvedValue({
          encryptedString: null,
        } as unknown as EncString);

        await expect(sut.validateAndAcceptInvite(invite, activeUserId)).rejects.toThrow(
          "Failed to encrypt user key for password reset enrollment.",
        );
        expect(organizationUserApiService.postOrganizationUserAccept).not.toHaveBeenCalled();
      });
    });
  });

  describe("getInvitePolicies", () => {
    it("returns policies on first fetch", async () => {
      const invite = createOrgInvite();
      const policies = [{ type: PolicyType.MasterPassword, enabled: true } as Policy];
      policyApiService.getPoliciesByToken.mockResolvedValue(policies);

      const result = await sut.getInvitePolicies(invite);

      expect(result).toEqual(policies);
      expect(policyApiService.getPoliciesByToken).toHaveBeenCalledWith(
        invite.organizationId,
        invite.token,
        invite.email,
        invite.organizationUserId,
      );
    });

    it("returns undefined and logs when the policy fetch throws", async () => {
      const invite = createOrgInvite();
      const error = new Error("fetch failed");
      policyApiService.getPoliciesByToken.mockRejectedValue(error);

      const result = await sut.getInvitePolicies(invite);

      expect(result).toBeUndefined();
      expect(logService.error).toHaveBeenCalledWith(error);
    });

    it("returns the cached result on the second call with the same invite token", async () => {
      const invite = createOrgInvite();
      const policies = [{ type: PolicyType.MasterPassword, enabled: true } as Policy];
      policyApiService.getPoliciesByToken.mockResolvedValue(policies);

      await sut.getInvitePolicies(invite);
      await sut.getInvitePolicies(invite);

      expect(policyApiService.getPoliciesByToken).toHaveBeenCalledTimes(1);
    });

    it("clears the cache on setOrganizationInvite so the next fetch goes to the API", async () => {
      const invite = createOrgInvite();
      const policies = [{ type: PolicyType.MasterPassword, enabled: true } as Policy];
      policyApiService.getPoliciesByToken.mockResolvedValue(policies);

      await sut.getInvitePolicies(invite);
      await sut.setOrganizationInvite(invite);
      await sut.getInvitePolicies(invite);

      expect(policyApiService.getPoliciesByToken).toHaveBeenCalledTimes(2);
    });

    it("clears the cache on clearOrganizationInvite so the next fetch goes to the API", async () => {
      const invite = createOrgInvite();
      const policies = [{ type: PolicyType.MasterPassword, enabled: true } as Policy];
      policyApiService.getPoliciesByToken.mockResolvedValue(policies);

      await sut.getInvitePolicies(invite);
      await sut.clearOrganizationInvite();
      await sut.getInvitePolicies(invite);

      expect(policyApiService.getPoliciesByToken).toHaveBeenCalledTimes(2);
    });

    it("scopes the cache by invite token so distinct invites each hit the API", async () => {
      const inviteA = createOrgInvite({ token: "tokenA" });
      const inviteB = createOrgInvite({ token: "tokenB" });
      policyApiService.getPoliciesByToken.mockResolvedValue([]);

      await sut.getInvitePolicies(inviteA);
      await sut.getInvitePolicies(inviteB);

      expect(policyApiService.getPoliciesByToken).toHaveBeenCalledTimes(2);
    });

    it("does not cache when the API returns null so subsequent calls retry", async () => {
      const invite = createOrgInvite();
      policyApiService.getPoliciesByToken.mockResolvedValue(null as any);

      await sut.getInvitePolicies(invite);
      await sut.getInvitePolicies(invite);

      expect(policyApiService.getPoliciesByToken).toHaveBeenCalledTimes(2);
    });
  });
});

function createOrgInvite(custom: Partial<OrganizationInvite> = {}): OrganizationInvite {
  return new OrganizationInvite({
    email: "user@example.com",
    initOrganization: false,
    orgUserHasExistingUser: false,
    organizationId: "organizationId",
    organizationName: "organizationName",
    organizationUserId: "organizationUserId",
    token: "token",
    ...custom,
  });
}
