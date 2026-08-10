import { MockProxy, mock } from "jest-mock-extended";
import { BehaviorSubject, firstValueFrom } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { OrganizationUserApiService } from "@bitwarden/admin-console/common";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { LogoutService } from "@bitwarden/auth/common";
import { newGuid } from "@bitwarden/guid";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { KeyService } from "@bitwarden/key-management";
import { OrganizationInviteLinkApiService } from "@bitwarden/organization-invite-link";
import { UserId } from "@bitwarden/user-core";

import { FakeGlobalStateProvider } from "../../../../../spec";
import { ApiService } from "../../../../abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "../../../../admin-console/abstractions/organization/organization-api.service.abstraction";
import { PolicyApiServiceAbstraction } from "../../../../admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyService } from "../../../../admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "../../../../admin-console/enums";
import { MasterPasswordPolicyOptions } from "../../../../admin-console/models/domain/master-password-policy-options";
import { Policy } from "../../../../admin-console/models/domain/policy";
import { ResetPasswordPolicyOptions } from "../../../../admin-console/models/domain/reset-password-policy-options";
import { OrganizationKeysResponse } from "../../../../admin-console/models/response/organization-keys.response";
import { FeatureFlag } from "../../../../enums/feature-flag.enum";
import { EncryptService } from "../../../../key-management/crypto/abstractions/encrypt.service";
import { EncString } from "../../../../key-management/crypto/models/enc-string";
import { ErrorResponse } from "../../../../models/response/error.response";
import { ConfigService } from "../../../../platform/abstractions/config/config.service";
import { I18nService } from "../../../../platform/abstractions/i18n.service";
import { LogService } from "../../../../platform/abstractions/log.service";
import { Utils } from "../../../../platform/misc/utils";
import { MockSdkService } from "../../../../platform/spec/mock-sdk.service";
import { OrgKey } from "../../../../types/key";
import { DeepLinkRedirectService } from "../../../deep-link-redirect";
import { OrgInviteKind } from "../../enums/org-invite-kind.enum";
import { DirectOrganizationInvite } from "../../models/direct-organization-invite";
import { OpenOrganizationInvite } from "../../models/open-organization-invite";
import { OpenOrgInviteAcceptResult } from "../../types/open-org-invite-accept-result.type";

import { DefaultOrganizationInviteService } from "./default-organization-invite.service";
import { EMAIL_SEALED_OPEN_ORG_INVITE_SECRET_RECORD_DISK_LOCAL } from "./sealed-open-org-invite-secret.state";

describe("DefaultOrganizationInviteService", () => {
  let sut: DefaultOrganizationInviteService;
  let apiService: MockProxy<ApiService>;
  let logoutService: MockProxy<LogoutService>;
  let keyService: MockProxy<KeyService>;
  let encryptService: MockProxy<EncryptService>;
  let policyApiService: MockProxy<PolicyApiServiceAbstraction>;
  let policyService: MockProxy<PolicyService>;
  let logService: MockProxy<LogService>;
  let organizationApiService: MockProxy<OrganizationApiServiceAbstraction>;
  let organizationUserApiService: MockProxy<OrganizationUserApiService>;
  let organizationInviteLinkApiService: MockProxy<OrganizationInviteLinkApiService>;
  let i18nService: MockProxy<I18nService>;
  let globalStateProvider: FakeGlobalStateProvider;
  let sdkService: MockSdkService;
  let configService: MockProxy<ConfigService>;
  // Deep-mock chain returned by sdkService.client.auth.mockDeep().registration.mockDeep().
  let registrationClient: any;
  let deepLinkRedirectService: MockProxy<DeepLinkRedirectService>;

  beforeEach(() => {
    apiService = mock();
    logoutService = mock();
    keyService = mock();
    encryptService = mock();
    policyApiService = mock();
    policyService = mock();
    logService = mock();
    organizationApiService = mock();
    organizationUserApiService = mock();
    organizationInviteLinkApiService = mock();
    i18nService = mock();
    globalStateProvider = new FakeGlobalStateProvider();
    sdkService = new MockSdkService();
    configService = mock();
    // Prime the deep-mock chain the service walks at seal/unseal time
    // (client.auth().registration()) so tests can inspect calls on the same mock instance.
    registrationClient = sdkService.client.auth.mockDeep().registration.mockDeep();
    deepLinkRedirectService = mock();

    sut = new DefaultOrganizationInviteService(
      apiService,
      logoutService,
      keyService,
      encryptService,
      policyApiService,
      policyService,
      logService,
      organizationApiService,
      organizationUserApiService,
      organizationInviteLinkApiService,
      i18nService,
      globalStateProvider,
      sdkService,
      configService,
      deepLinkRedirectService,
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

    describe("mutual exclusion across kinds", () => {
      it("clears any stashed open org invite when a direct invite is set", async () => {
        const open = createOpenOrgInvite();
        await sut.setOrganizationInvite(open);

        const direct = createOrgInvite();
        await sut.setOrganizationInvite(direct);

        expect(await sut.getOrganizationInvite()).toEqual(direct);
      });

      it("clears any stashed direct invite when an open org invite is set", async () => {
        const direct = createOrgInvite();
        await sut.setOrganizationInvite(direct);

        const open = createOpenOrgInvite();
        await sut.setOrganizationInvite(open);

        expect(await sut.getOrganizationInvite()).toEqual(open);
      });
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

  describe("clearOpenOrgInvite", () => {
    it("clears the open org invite", async () => {
      const open = createOpenOrgInvite();
      await sut.setOrganizationInvite(open);

      await sut.clearOpenOrgInvite();

      expect(await sut.getOrganizationInvite()).toBeNull();
    });

    it("leaves a stashed direct invite intact (clears only the open key)", async () => {
      await sut.setOrganizationInvite(createOrgInvite());

      await sut.clearOpenOrgInvite();

      const stored = await sut.getOrganizationInvite();
      expect(stored?.kind).toBe(OrgInviteKind.Direct);
    });
  });

  describe("activeInvite$", () => {
    it("emits null when neither invite is stashed", async () => {
      const result = await firstValueFrom(sut.activeInvite$);
      expect(result).toBeNull();
    });

    it("emits the direct invite when one is stashed", async () => {
      const direct = createOrgInvite();
      await sut.setOrganizationInvite(direct);

      const result = await firstValueFrom(sut.activeInvite$);
      expect(result).toEqual(direct);
    });

    it("emits the open org invite when one is stashed", async () => {
      const open = createOpenOrgInvite();
      await sut.setOrganizationInvite(open);

      const result = await firstValueFrom(sut.activeInvite$);
      expect(result).toEqual(open);
    });
  });

  describe("validateAndAcceptDirectOrgInvite", () => {
    const activeUserId = newGuid() as UserId;
    // Callers pass their current page URL so the deep-link guard can replay
    // it after re-auth on the MP-policy detour. Value is opaque to the SUT.
    const acceptOrgUrl = "/accept-organization?token=xyz&email=user@example.com";

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

      const result = await sut.validateAndAcceptDirectOrgInvite(invite, activeUserId, acceptOrgUrl);

      expect(result).toBe(true);
      expect(organizationUserApiService.postOrganizationUserAcceptInit).toHaveBeenCalled();
      expect(keyService.makeOrgKey).toHaveBeenCalledWith(activeUserId);
      expect(keyService.makeKeyPair).toHaveBeenCalledWith(mockOrgKey);
      expect(apiService.refreshIdentityToken).toHaveBeenCalled();
      expect(organizationUserApiService.postOrganizationUserAccept).not.toHaveBeenCalled();
      expect(logoutService.logout).not.toHaveBeenCalled();
      const stored = await sut.getOrganizationInvite();
      expect(stored).toBeNull();
    });

    it("names the default collection using the collection terminology when the VFO1 flag is off", async () => {
      keyService.makeOrgKey.mockResolvedValue([
        { encryptedString: "string" } as EncString,
        "orgPrivateKey" as unknown as OrgKey,
      ]);
      keyService.makeKeyPair.mockResolvedValue([
        "orgPublicKey",
        { encryptedString: "string" } as EncString,
      ]);
      encryptService.encryptString.mockResolvedValue({ encryptedString: "string" } as EncString);
      configService.getFeatureFlag.mockResolvedValue(false);

      await sut.validateAndAcceptDirectOrgInvite(
        createOrgInvite({ initOrganization: true }),
        activeUserId,
        acceptOrgUrl,
      );

      expect(configService.getFeatureFlag).toHaveBeenCalledWith(FeatureFlag.VFO1Foundation);
      expect(i18nService.t).toHaveBeenCalledWith("defaultCollection");
    });

    it("names the default collection using the shared-folder terminology when the VFO1 flag is on", async () => {
      keyService.makeOrgKey.mockResolvedValue([
        { encryptedString: "string" } as EncString,
        "orgPrivateKey" as unknown as OrgKey,
      ]);
      keyService.makeKeyPair.mockResolvedValue([
        "orgPublicKey",
        { encryptedString: "string" } as EncString,
      ]);
      encryptService.encryptString.mockResolvedValue({ encryptedString: "string" } as EncString);
      configService.getFeatureFlag.mockResolvedValue(true);

      await sut.validateAndAcceptDirectOrgInvite(
        createOrgInvite({ initOrganization: true }),
        activeUserId,
        acceptOrgUrl,
      );

      expect(configService.getFeatureFlag).toHaveBeenCalledWith(FeatureFlag.VFO1Foundation);
      expect(i18nService.t).toHaveBeenCalledWith("defaultSharedFolder");
    });

    it("stashes + persists + logs out on the paste-URL MP-policy detour", async () => {
      const invite = createOrgInvite();
      policyApiService.getPoliciesByToken.mockResolvedValue([
        {
          type: PolicyType.MasterPassword,
          enabled: true,
        } as Policy,
      ]);

      const result = await sut.validateAndAcceptDirectOrgInvite(invite, activeUserId, acceptOrgUrl);

      expect(result).toBe(false);
      expect(logoutService.logout).toHaveBeenCalled();
      expect(deepLinkRedirectService.persistPostLoginRedirectUrl).toHaveBeenCalledWith(
        acceptOrgUrl,
      );
      // Persist must happen before logout so any state-clearing side effects of logout
      // cannot wipe the URL the deep-link guard will replay after re-auth.
      expect(
        deepLinkRedirectService.persistPostLoginRedirectUrl.mock.invocationCallOrder[0],
      ).toBeLessThan(logoutService.logout.mock.invocationCallOrder[0]);
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

      const result = await sut.validateAndAcceptDirectOrgInvite(
        providedInvite,
        activeUserId,
        acceptOrgUrl,
      );

      expect(result).toBe(false);
      expect(logoutService.logout).toHaveBeenCalled();
      const stored = await sut.getOrganizationInvite();
      expect(stored).toEqual(providedInvite);
    });

    it("fires the master-password-policy detour even when an open org invite is stashed", async () => {
      // A stash of the opposite kind must not count as "policy already checked" for
      // the incoming direct invite — different invites can't share a detour breadcrumb.
      const stashedOpen = new OpenOrganizationInvite({
        organizationId: "open-org-id",
        inviteLinkCode: "open-link-code",
        inviteKey: "open-org-invite-key",
        organizationName: "OpenOrg",
      });
      await sut.setOrganizationInvite(stashedOpen);
      const invite = createOrgInvite();
      policyApiService.getPoliciesByToken.mockResolvedValue([
        { type: PolicyType.MasterPassword, enabled: true } as Policy,
      ]);
      // Prime so that if the detour is (incorrectly) skipped, the accept path
      // reaches a clean "accepted" outcome — makes the test failure read as
      // "invite accepted when detour should have fired" rather than an unrelated
      // NPE deeper in the accept path.
      policyService.getResetPasswordPolicyOptions.mockReturnValue([
        { autoEnrollEnabled: false } as ResetPasswordPolicyOptions,
        false,
      ]);

      const result = await sut.validateAndAcceptDirectOrgInvite(invite, activeUserId, acceptOrgUrl);

      expect(result).toBe(false);
      expect(logoutService.logout).toHaveBeenCalled();
      const stored = await sut.getOrganizationInvite();
      expect(stored).toEqual(invite);
    });

    it("accepts the invite when the organization doesn't have a master password policy", async () => {
      const invite = createOrgInvite();
      policyApiService.getPoliciesByToken.mockResolvedValue([]);

      const result = await sut.validateAndAcceptDirectOrgInvite(invite, activeUserId, acceptOrgUrl);

      expect(result).toBe(true);
      expect(organizationUserApiService.postOrganizationUserAccept).toHaveBeenCalled();
      expect(apiService.refreshIdentityToken).toHaveBeenCalled();
      expect(organizationUserApiService.postOrganizationUserAcceptInit).not.toHaveBeenCalled();
      expect(logoutService.logout).not.toHaveBeenCalled();
      const stored = await sut.getOrganizationInvite();
      expect(stored).toBeNull();
    });

    it("fetches policies once when accepting an invite with non-MP policies and no stored invite", async () => {
      // Regression: the email-mismatch guard in directInviteMasterPasswordPolicyCheckRequired
      // ran clearOrganizationInvite when storedInvite was null, wiping the
      // freshly-populated policyCache and forcing directInviteRequiresResetPasswordAutoEnroll
      // to re-fetch the same policies during the same acceptDirectOrgInvite() call.
      const invite = createOrgInvite();
      policyApiService.getPoliciesByToken.mockResolvedValue([
        { type: PolicyType.SingleOrg, enabled: true } as Policy,
      ]);
      policyService.getResetPasswordPolicyOptions.mockReturnValue([
        { autoEnrollEnabled: false } as ResetPasswordPolicyOptions,
        false,
      ]);

      await sut.validateAndAcceptDirectOrgInvite(invite, activeUserId, acceptOrgUrl);

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

      const result = await sut.validateAndAcceptDirectOrgInvite(invite, activeUserId, acceptOrgUrl);

      expect(result).toBe(true);
      expect(organizationUserApiService.postOrganizationUserAccept).toHaveBeenCalled();
      expect(organizationUserApiService.postOrganizationUserAcceptInit).not.toHaveBeenCalled();
      const stored = await sut.getOrganizationInvite();
      expect(stored).toBeNull();
      expect(logoutService.logout).not.toHaveBeenCalled();
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

      const result = await sut.validateAndAcceptDirectOrgInvite(invite, activeUserId, acceptOrgUrl);

      expect(result).toBe(true);
      expect(encryptService.encapsulateKeyUnsigned).toHaveBeenCalledWith(
        { key: "userKey" },
        Utils.fromB64ToArray("publicKey"),
      );
      expect(organizationUserApiService.postOrganizationUserAccept).toHaveBeenCalled();
      expect(organizationUserApiService.postOrganizationUserAcceptInit).not.toHaveBeenCalled();
      const stored = await sut.getOrganizationInvite();
      expect(stored).toBeNull();
      expect(logoutService.logout).not.toHaveBeenCalled();
    });

    describe("acceptDirectOrgInviteAndInitOrganization encryption guards", () => {
      const mockOrgKey = "orgPrivateKey" as unknown as OrgKey;
      let invite: DirectOrganizationInvite;

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

        await expect(
          sut.validateAndAcceptDirectOrgInvite(invite, activeUserId, acceptOrgUrl),
        ).rejects.toThrow("Failed to encrypt organization init data.");
        expect(organizationUserApiService.postOrganizationUserAcceptInit).not.toHaveBeenCalled();
      });

      it("throws when the encrypted org private key has a null encryptedString", async () => {
        keyService.makeKeyPair.mockResolvedValue([
          "orgPublicKey",
          { encryptedString: null } as unknown as EncString,
        ]);

        await expect(
          sut.validateAndAcceptDirectOrgInvite(invite, activeUserId, acceptOrgUrl),
        ).rejects.toThrow("Failed to encrypt organization init data.");
        expect(organizationUserApiService.postOrganizationUserAcceptInit).not.toHaveBeenCalled();
      });

      it("throws when the encrypted default collection has a null encryptedString", async () => {
        encryptService.encryptString.mockResolvedValue({
          encryptedString: null,
        } as unknown as EncString);

        await expect(
          sut.validateAndAcceptDirectOrgInvite(invite, activeUserId, acceptOrgUrl),
        ).rejects.toThrow("Failed to encrypt organization init data.");
        expect(organizationUserApiService.postOrganizationUserAcceptInit).not.toHaveBeenCalled();
      });
    });

    describe("reset password enrollment errors", () => {
      let invite: DirectOrganizationInvite;

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

        await expect(
          sut.validateAndAcceptDirectOrgInvite(invite, activeUserId, acceptOrgUrl),
        ).rejects.toThrow();
        expect(i18nService.t).toHaveBeenCalledWith("resetPasswordOrgKeysError");
        expect(organizationUserApiService.postOrganizationUserAccept).not.toHaveBeenCalled();
      });

      it("throws when the user key is null", async () => {
        keyService.userKey$.mockReturnValue(new BehaviorSubject(null as any));

        await expect(
          sut.validateAndAcceptDirectOrgInvite(invite, activeUserId, acceptOrgUrl),
        ).rejects.toThrow("User key is required to enroll in password reset.");
        expect(organizationUserApiService.postOrganizationUserAccept).not.toHaveBeenCalled();
      });

      it("throws when the encapsulated user key has a null encryptedString", async () => {
        encryptService.encapsulateKeyUnsigned.mockResolvedValue({
          encryptedString: null,
        } as unknown as EncString);

        await expect(
          sut.validateAndAcceptDirectOrgInvite(invite, activeUserId, acceptOrgUrl),
        ).rejects.toThrow("Failed to encrypt user key for password reset enrollment.");
        expect(organizationUserApiService.postOrganizationUserAccept).not.toHaveBeenCalled();
      });
    });
  });

  describe("getOrgPoliciesForInvite", () => {
    describe("direct branch", () => {
      it("returns policies on first fetch", async () => {
        const invite = createOrgInvite();
        const policies = [{ type: PolicyType.MasterPassword, enabled: true } as Policy];
        policyApiService.getPoliciesByToken.mockResolvedValue(policies);

        const result = await sut.getOrgPoliciesForInvite(invite);

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

        const result = await sut.getOrgPoliciesForInvite(invite);

        expect(result).toBeUndefined();
        expect(logService.error).toHaveBeenCalledWith(error);
      });

      it("returns the cached result on the second call with the same invite token", async () => {
        const invite = createOrgInvite();
        const policies = [{ type: PolicyType.MasterPassword, enabled: true } as Policy];
        policyApiService.getPoliciesByToken.mockResolvedValue(policies);

        await sut.getOrgPoliciesForInvite(invite);
        await sut.getOrgPoliciesForInvite(invite);

        expect(policyApiService.getPoliciesByToken).toHaveBeenCalledTimes(1);
      });

      it("clears the cache on setOrganizationInvite so the next fetch goes to the API", async () => {
        const invite = createOrgInvite();
        const policies = [{ type: PolicyType.MasterPassword, enabled: true } as Policy];
        policyApiService.getPoliciesByToken.mockResolvedValue(policies);

        await sut.getOrgPoliciesForInvite(invite);
        await sut.setOrganizationInvite(invite);
        await sut.getOrgPoliciesForInvite(invite);

        expect(policyApiService.getPoliciesByToken).toHaveBeenCalledTimes(2);
      });

      it("clears the cache on clearOrganizationInvite so the next fetch goes to the API", async () => {
        const invite = createOrgInvite();
        const policies = [{ type: PolicyType.MasterPassword, enabled: true } as Policy];
        policyApiService.getPoliciesByToken.mockResolvedValue(policies);

        await sut.getOrgPoliciesForInvite(invite);
        await sut.clearOrganizationInvite();
        await sut.getOrgPoliciesForInvite(invite);

        expect(policyApiService.getPoliciesByToken).toHaveBeenCalledTimes(2);
      });

      it("scopes the cache by invite token so distinct invites each hit the API", async () => {
        const inviteA = createOrgInvite({ token: "tokenA" });
        const inviteB = createOrgInvite({ token: "tokenB" });
        policyApiService.getPoliciesByToken.mockResolvedValue([]);

        await sut.getOrgPoliciesForInvite(inviteA);
        await sut.getOrgPoliciesForInvite(inviteB);

        expect(policyApiService.getPoliciesByToken).toHaveBeenCalledTimes(2);
      });

      it("does not cache when the API returns null so subsequent calls retry", async () => {
        const invite = createOrgInvite();
        policyApiService.getPoliciesByToken.mockResolvedValue(null as any);

        await sut.getOrgPoliciesForInvite(invite);
        await sut.getOrgPoliciesForInvite(invite);

        expect(policyApiService.getPoliciesByToken).toHaveBeenCalledTimes(2);
      });
    });

    describe("open branch", () => {
      it("routes open org invites to getPoliciesByInviteLinkCode keyed by (organizationId, inviteLinkCode)", async () => {
        const open = createOpenOrgInvite();
        const policies = [{ type: PolicyType.MasterPassword, enabled: true } as Policy];
        policyApiService.getPoliciesByInviteLinkCode.mockResolvedValue(policies);

        const result = await sut.getOrgPoliciesForInvite(open);

        expect(result).toEqual(policies);
        expect(policyApiService.getPoliciesByInviteLinkCode).toHaveBeenCalledWith(
          open.organizationId,
          open.inviteLinkCode,
        );
        expect(policyApiService.getPoliciesByToken).not.toHaveBeenCalled();
      });

      it("caches the open-org-invite policy list by inviteLinkCode", async () => {
        const open = createOpenOrgInvite();
        policyApiService.getPoliciesByInviteLinkCode.mockResolvedValue([]);

        await sut.getOrgPoliciesForInvite(open);
        await sut.getOrgPoliciesForInvite(open);

        expect(policyApiService.getPoliciesByInviteLinkCode).toHaveBeenCalledTimes(1);
      });

      it("returns undefined and logs when the open-branch fetch throws", async () => {
        const open = createOpenOrgInvite();
        const error = new Error("link fetch failed");
        policyApiService.getPoliciesByInviteLinkCode.mockRejectedValue(error);

        const result = await sut.getOrgPoliciesForInvite(open);

        expect(result).toBeUndefined();
        expect(logService.error).toHaveBeenCalledWith(error);
      });
    });
  });

  describe("getMasterPasswordPolicyOptionsForInvite", () => {
    it("derives MP options from the invite's policies", async () => {
      const invite = createOrgInvite();
      const policies = [{ type: PolicyType.MasterPassword, enabled: true } as Policy];
      const expectedOptions = { minLength: 12 } as MasterPasswordPolicyOptions;
      policyApiService.getPoliciesByToken.mockResolvedValue(policies);
      policyService.combinePoliciesIntoMasterPasswordPolicyOptions.mockReturnValue(expectedOptions);

      const result = await sut.getMasterPasswordPolicyOptionsForInvite(invite);

      expect(result).toBe(expectedOptions);
      expect(policyService.combinePoliciesIntoMasterPasswordPolicyOptions).toHaveBeenCalledWith(
        policies,
      );
    });

    it("returns undefined when the underlying policy fetch throws", async () => {
      const invite = createOrgInvite();
      policyApiService.getPoliciesByToken.mockRejectedValue(new Error("fetch failed"));

      const result = await sut.getMasterPasswordPolicyOptionsForInvite(invite);

      expect(result).toBeUndefined();
      expect(policyService.combinePoliciesIntoMasterPasswordPolicyOptions).not.toHaveBeenCalled();
    });

    it("returns undefined when the underlying policy fetch returns null without throwing", async () => {
      const invite = createOrgInvite();
      policyApiService.getPoliciesByToken.mockResolvedValue(null as any);

      const result = await sut.getMasterPasswordPolicyOptionsForInvite(invite);

      expect(result).toBeUndefined();
      expect(policyService.combinePoliciesIntoMasterPasswordPolicyOptions).not.toHaveBeenCalled();
    });

    it("returns undefined when the org has no MP policy (combiner returns undefined)", async () => {
      const invite = createOrgInvite();
      const policies = [{ type: PolicyType.SingleOrg, enabled: true } as Policy];
      policyApiService.getPoliciesByToken.mockResolvedValue(policies);
      policyService.combinePoliciesIntoMasterPasswordPolicyOptions.mockReturnValue(undefined);

      const result = await sut.getMasterPasswordPolicyOptionsForInvite(invite);

      expect(result).toBeUndefined();
    });

    it("reuses the cached policy list across repeat calls for the same invite", async () => {
      const invite = createOrgInvite();
      const policies = [{ type: PolicyType.MasterPassword, enabled: true } as Policy];
      policyApiService.getPoliciesByToken.mockResolvedValue(policies);
      policyService.combinePoliciesIntoMasterPasswordPolicyOptions.mockReturnValue(
        {} as MasterPasswordPolicyOptions,
      );

      await sut.getMasterPasswordPolicyOptionsForInvite(invite);
      await sut.getMasterPasswordPolicyOptionsForInvite(invite);

      expect(policyApiService.getPoliciesByToken).toHaveBeenCalledTimes(1);
    });
  });

  describe("acceptOpenOrgInvite", () => {
    const activeUserId = newGuid() as UserId;
    const organizationId = newGuid();
    // Callers pass their current page URL so the deep-link guard can replay
    // it after re-auth on the MP-policy detour. Value is opaque to the SUT.
    const acceptOrgUrl = "/join/orgId/link-code?key=xyz";
    // Deep-mock chain returned by userClient.invite_link.mockDeep(); holds
    // .accept_and_optionally_confirm which our implementation calls.
    let inviteLinkClient: any;

    beforeEach(() => {
      const userClient = sdkService.simulate.userLogin(activeUserId);
      inviteLinkClient = userClient.invite_link.mockDeep();
      inviteLinkClient.accept_and_optionally_confirm.mockResolvedValue(undefined);
      // Default: no MP-policy detour, no AR auto-enroll, VFO1 off. Individual tests
      // override.
      policyApiService.getPoliciesByInviteLinkCode.mockResolvedValue([]);
      configService.getFeatureFlag.mockResolvedValue(false);
      i18nService.t.mockImplementation((key: string) => key);
    });

    /**
     * Fabricates the `InviteLinkError { variant: "Api" }` shape the SDK produces when a
     * server response fails. Mirrors `bitwarden-core::ApiError::Response`'s Display
     * output: `Received error message from server: [{status} {reason}] {json-body}`,
     * where `{json-body}` is the raw server error response envelope. The name/variant
     * fields are what `isInviteLinkError` uses to identify the error.
     */
    const makeSdkApiError = (statusCode: number, message: string): Error => {
      const reasonPhrase = statusCode === 400 ? "Bad Request" : "Internal Server Error";
      const body = JSON.stringify({
        message,
        validationErrors: null,
        exceptionMessage: null,
        exceptionStackTrace: null,
        innerExceptionMessage: null,
        object: "error",
      });
      const err = new Error(
        `Received error message from server: [${statusCode} ${reasonPhrase}] ${body}`,
      ) as Error & { name: string; variant: string };
      err.name = "InviteLinkError";
      err.variant = "Api";
      return err;
    };

    /**
     * Variant of {@link makeSdkApiError} that lets a test supply a raw string body in
     * place of the standard JSON envelope. Used to exercise the JSON-parse and
     * missing-`.message` fall-through paths in the classifier.
     */
    const makeSdkApiErrorWithRawBody = (statusCode: number, body: string): Error => {
      const err = new Error(
        `Received error message from server: [${statusCode} Bad Request] ${body}`,
      ) as Error & { name: string; variant: string };
      err.name = "InviteLinkError";
      err.variant = "Api";
      return err;
    };

    const makeSdkError = (variant: string, message: string): Error => {
      const err = new Error(message) as Error & { name: string; variant: string };
      err.name = "InviteLinkError";
      err.variant = variant;
      return err;
    };

    it("returns accepted, calls the SDK with the expected args, refreshes the identity token, and clears any stashed invite on success", async () => {
      const open = createOpenOrgInvite({ organizationId });

      const result = await sut.acceptOpenOrgInvite(open, activeUserId, acceptOrgUrl);

      expect(result).toEqual({ kind: "accepted" });
      expect(inviteLinkClient.accept_and_optionally_confirm).toHaveBeenCalledWith(
        organizationId,
        open.inviteLinkCode,
        open.inviteKey,
        "defaultCollection",
        false,
      );
      expect(apiService.refreshIdentityToken).toHaveBeenCalled();
      expect(await sut.getOrganizationInvite()).toBeNull();
    });

    it("passes enrollIntoAccountRecovery=true when the org's ResetPassword policy has auto-enroll enabled", async () => {
      const open = createOpenOrgInvite({ organizationId });
      policyApiService.getPoliciesByInviteLinkCode.mockResolvedValue([
        { type: PolicyType.ResetPassword, enabled: true } as Policy,
      ]);
      policyService.getResetPasswordPolicyOptions.mockReturnValue([
        { autoEnrollEnabled: true } as ResetPasswordPolicyOptions,
        true,
      ]);

      await sut.acceptOpenOrgInvite(open, activeUserId, acceptOrgUrl);

      expect(inviteLinkClient.accept_and_optionally_confirm).toHaveBeenCalledWith(
        organizationId,
        open.inviteLinkCode,
        open.inviteKey,
        "defaultCollection",
        true,
      );
    });

    it("passes enrollIntoAccountRecovery=false when the ResetPassword policy exists but autoEnrollEnabled is false", async () => {
      const open = createOpenOrgInvite({ organizationId });
      policyApiService.getPoliciesByInviteLinkCode.mockResolvedValue([
        { type: PolicyType.ResetPassword, enabled: true } as Policy,
      ]);
      policyService.getResetPasswordPolicyOptions.mockReturnValue([
        { autoEnrollEnabled: false } as ResetPasswordPolicyOptions,
        true,
      ]);

      await sut.acceptOpenOrgInvite(open, activeUserId, acceptOrgUrl);

      expect(inviteLinkClient.accept_and_optionally_confirm).toHaveBeenCalledWith(
        organizationId,
        expect.any(String),
        expect.any(String),
        expect.any(String),
        false,
      );
    });

    it("passes defaultSharedFolder as the default collection name when the VFO1 flag is on", async () => {
      configService.getFeatureFlag.mockImplementation(async (flag) =>
        flag === FeatureFlag.VFO1Foundation ? true : false,
      );
      const open = createOpenOrgInvite({ organizationId });

      await sut.acceptOpenOrgInvite(open, activeUserId, acceptOrgUrl);

      expect(configService.getFeatureFlag).toHaveBeenCalledWith(FeatureFlag.VFO1Foundation);
      expect(i18nService.t).toHaveBeenCalledWith("defaultSharedFolder");
      expect(inviteLinkClient.accept_and_optionally_confirm).toHaveBeenCalledWith(
        organizationId,
        expect.any(String),
        expect.any(String),
        "defaultSharedFolder",
        false,
      );
    });

    it("returns stashed-for-mp-policy-detour and does not call the SDK when the org enforces an unsatisfied MP policy", async () => {
      const open = createOpenOrgInvite({ organizationId });
      policyApiService.getPoliciesByInviteLinkCode.mockResolvedValue([
        { type: PolicyType.MasterPassword, enabled: true } as Policy,
      ]);

      const result = await sut.acceptOpenOrgInvite(open, activeUserId, acceptOrgUrl);

      expect(result).toEqual({ kind: "stashed-for-mp-policy-detour" });
      expect(logoutService.logout).toHaveBeenCalled();
      expect(deepLinkRedirectService.persistPostLoginRedirectUrl).toHaveBeenCalledWith(
        acceptOrgUrl,
      );
      // Persist must happen before logout so any state-clearing side effects of logout
      // cannot wipe the URL the deep-link guard will replay after re-auth.
      expect(
        deepLinkRedirectService.persistPostLoginRedirectUrl.mock.invocationCallOrder[0],
      ).toBeLessThan(logoutService.logout.mock.invocationCallOrder[0]);
      expect(await sut.getOrganizationInvite()).toEqual(open);
      expect(inviteLinkClient.accept_and_optionally_confirm).not.toHaveBeenCalled();
    });

    it("fires the master-password-policy detour even when a direct invite is stashed", async () => {
      // A stash of the opposite kind must not count as "policy already checked" for
      // the incoming open org invite — different invites can't share a detour breadcrumb.
      const stashedDirect = createOrgInvite();
      await sut.setOrganizationInvite(stashedDirect);
      const open = createOpenOrgInvite({ organizationId });
      policyApiService.getPoliciesByInviteLinkCode.mockResolvedValue([
        { type: PolicyType.MasterPassword, enabled: true } as Policy,
      ]);
      // Prime so that if the detour is (incorrectly) skipped, the accept path
      // reaches a clean "accepted" outcome — makes the test failure read as
      // "invite accepted when detour should have fired" rather than an unrelated
      // NPE deeper in the accept path.
      policyService.getResetPasswordPolicyOptions.mockReturnValue([
        { autoEnrollEnabled: false } as ResetPasswordPolicyOptions,
        false,
      ]);

      const result = await sut.acceptOpenOrgInvite(open, activeUserId, acceptOrgUrl);

      expect(result).toEqual({ kind: "stashed-for-mp-policy-detour" });
      expect(logoutService.logout).toHaveBeenCalled();
      expect(deepLinkRedirectService.persistPostLoginRedirectUrl).toHaveBeenCalledWith(
        acceptOrgUrl,
      );
      expect(
        deepLinkRedirectService.persistPostLoginRedirectUrl.mock.invocationCallOrder[0],
      ).toBeLessThan(logoutService.logout.mock.invocationCallOrder[0]);
      expect(await sut.getOrganizationInvite()).toEqual(open);
      expect(inviteLinkClient.accept_and_optionally_confirm).not.toHaveBeenCalled();
    });

    it("accepts when the org enforces an MP policy but a matching open org invite is already stashed", async () => {
      const open = createOpenOrgInvite({ organizationId });
      // Pre-store the invite to indicate the user has already passed the MP policy check.
      await sut.setOrganizationInvite(open);
      policyApiService.getPoliciesByInviteLinkCode.mockResolvedValue([
        { type: PolicyType.MasterPassword, enabled: true } as Policy,
      ]);
      policyService.getResetPasswordPolicyOptions.mockReturnValue([
        { autoEnrollEnabled: false } as ResetPasswordPolicyOptions,
        false,
      ]);

      const result = await sut.acceptOpenOrgInvite(open, activeUserId, acceptOrgUrl);

      expect(result).toEqual({ kind: "accepted" });
      expect(logoutService.logout).not.toHaveBeenCalled();
      expect(inviteLinkClient.accept_and_optionally_confirm).toHaveBeenCalled();
      expect(await sut.getOrganizationInvite()).toBeNull();
    });

    it("clears the stored open org invite when a master password policy check is required but the stored open invite's inviteLinkCode doesn't match the provided one", async () => {
      const stashedOpen = createOpenOrgInvite({ inviteLinkCode: "different-link-code" });
      const providedOpen = createOpenOrgInvite({ organizationId });
      await sut.setOrganizationInvite(stashedOpen);
      policyApiService.getPoliciesByInviteLinkCode.mockResolvedValue([
        { type: PolicyType.MasterPassword, enabled: true } as Policy,
      ]);

      const result = await sut.acceptOpenOrgInvite(providedOpen, activeUserId, acceptOrgUrl);

      expect(result).toEqual({ kind: "stashed-for-mp-policy-detour" });
      expect(logoutService.logout).toHaveBeenCalled();
      expect(await sut.getOrganizationInvite()).toEqual(providedOpen);
      expect(inviteLinkClient.accept_and_optionally_confirm).not.toHaveBeenCalled();
    });

    /**
     * Classifier cases — each rejection maps to a kind on {@link OpenOrgInviteAcceptResult}.
     * The 400-branch server messages mirror the strings defined in
     * `server/src/Core/AdminConsole/OrganizationFeatures/InviteLinks/Errors.cs` (and the
     * sibling AcceptMembership/AutoConfirmUser/SingleOrganizationPolicy error files); a
     * copy change on the server fails the corresponding test here alongside the
     * classifier, so drift is caught early.
     */
    describe("classifies accept-endpoint rejections", () => {
      const runWithRejection = async (err: unknown) => {
        const open = createOpenOrgInvite({ organizationId });
        // Pre-stash so every rejection case proves the catch-block clear happened
        // (asserted below) alongside its classifier result — a per-branch refactor
        // that drops the clear on any variant then fails its row.
        await sut.setOrganizationInvite(open);
        inviteLinkClient.accept_and_optionally_confirm.mockRejectedValue(err);
        const result = await sut.acceptOpenOrgInvite(open, activeUserId, acceptOrgUrl);
        expect(await sut.getOrganizationInvite()).toBeNull();
        return result;
      };

      // Each row is (server error name, HTTP status, exact server message, expected client
      // kind).
      it.each<{
        serverErrorName: string;
        statusCode: number;
        message: string;
        expectedKind: OpenOrgInviteAcceptResult["kind"];
      }>([
        {
          serverErrorName: "InviteLinkNotFound",
          statusCode: 404,
          message: "Invite link not found.",
          expectedKind: "link-not-found",
        },
        {
          serverErrorName: "InviteLinkNotAvailable",
          statusCode: 400,
          message: "Your organization's plan does not support invite links.",
          expectedKind: "plan-not-supported",
        },
        {
          serverErrorName: "EmailDomainNotAllowed",
          statusCode: 400,
          message: "You're not allowed to join the Acme Co vault with your email domain.",
          expectedKind: "email-domain-not-allowed",
        },
        {
          serverErrorName: "AlreadyOrganizationMember",
          statusCode: 400,
          message: "You're already a member of Acme Co.",
          expectedKind: "already-member",
        },
        {
          serverErrorName: "OrganizationAccessRevoked",
          statusCode: 400,
          message: "Your access to the Acme Co vault has been revoked.",
          expectedKind: "org-access-revoked",
        },
        {
          serverErrorName: "OrganizationHasNoAvailableSeats",
          statusCode: 400,
          message: "The Acme Co vault has no available seats.",
          expectedKind: "no-seats",
        },
        {
          serverErrorName: "SeatAddFailed (folded into no-seats)",
          statusCode: 400,
          message: "Unable to join this vault right now. Please contact your organization admin.",
          expectedKind: "no-seats",
        },
        {
          serverErrorName: "TwoFactorRequiredForMembership",
          statusCode: 400,
          message:
            "You cannot join this organization vault until you enable two-step login on your user account.",
          expectedKind: "two-factor-required",
        },
        {
          serverErrorName: "UserEmailNotVerified",
          statusCode: 400,
          message: "You must verify your email address before joining an organization.",
          expectedKind: "email-not-verified",
        },
        {
          serverErrorName: "UserIsAMemberOfAnotherOrganization",
          statusCode: 400,
          message:
            "Member cannot join this organization vault until they leave all other organization vaults.",
          expectedKind: "single-org-policy-violation-target-org",
        },
        {
          serverErrorName: "UserIsAMemberOfAnOrganizationThatHasSingleOrgPolicy",
          statusCode: 400,
          message:
            "Member cannot join this organization's vault because they are a member of another organization which forbids it.",
          expectedKind: "single-org-policy-violation-other-org",
        },
        {
          serverErrorName: "UserCannotBelongToAnotherOrganization",
          statusCode: 400,
          message:
            "Cannot confirm user@example.com until they leave all other organization vaults.",
          expectedKind: "auto-confirm-policy-violation-target-org",
        },
        {
          serverErrorName: "OtherOrganizationDoesNotAllowOtherMembership",
          statusCode: 400,
          message:
            "Cannot confirm user@example.com because they are a member of another organization which forbids it.",
          expectedKind: "auto-confirm-policy-violation-other-org",
        },
        {
          serverErrorName: "ProviderUsersCannotAcceptInviteLink",
          statusCode: 400,
          message: "Provider users cannot join organization vaults via invite link.",
          expectedKind: "provider-users-disallowed",
        },
        {
          serverErrorName: "OnlyOneFreeOrganizationAdminAllowed",
          statusCode: 400,
          message: "You can only be an admin of 1 free organization vault.",
          expectedKind: "free-admin-limit-reached",
        },
        {
          serverErrorName: "ResetPasswordKeyRequired",
          statusCode: 400,
          message: "Master Password reset is required, but not provided.",
          expectedKind: "reset-password-key-required",
        },
      ])(
        "classifies $serverErrorName as $expectedKind",
        async ({ statusCode, message, expectedKind }) => {
          const result = await runWithRejection(makeSdkApiError(statusCode, message));
          expect(result).toEqual({ kind: expectedKind });
        },
      );

      it("returns recovery-key-mismatch for the SDK-native RecoveryKeyMismatch variant", async () => {
        const result = await runWithRejection(
          makeSdkError(
            "RecoveryKeyMismatch",
            "Account recovery public key does not match the invite's bound organization key",
          ),
        );
        expect(result).toEqual({ kind: "recovery-key-mismatch" });
      });

      it("returns unexpected for the SDK Crypto variant", async () => {
        const result = await runWithRejection(makeSdkError("Crypto", "invalid key"));
        expect(result).toEqual({ kind: "unexpected", errorMessage: "invalid key" });
      });

      it("returns unexpected for the SDK Invite variant", async () => {
        const result = await runWithRejection(makeSdkError("Invite", "unseal failed"));
        expect(result).toEqual({ kind: "unexpected", errorMessage: "unseal failed" });
      });

      it("returns unexpected for the SDK MissingField variant", async () => {
        const result = await runWithRejection(
          makeSdkError("MissingField", "field 'invite' missing"),
        );
        expect(result).toEqual({ kind: "unexpected", errorMessage: "field 'invite' missing" });
      });

      it("returns unexpected with the server's message for an unrecognized 400", async () => {
        const result = await runWithRejection(
          makeSdkApiError(400, "some future error the client doesn't know about"),
        );
        expect(result).toEqual({
          kind: "unexpected",
          errorMessage: "some future error the client doesn't know about",
        });
      });

      it("returns unexpected with the server's message for 5xx responses", async () => {
        const result = await runWithRejection(makeSdkApiError(500, "boom"));
        expect(result).toEqual({ kind: "unexpected", errorMessage: "boom" });
      });

      it("returns unexpected with the raw SDK message when the Api-error prefix doesn't match", async () => {
        const result = await runWithRejection(makeSdkError("Api", "totally unrecognized wrapper"));
        expect(result).toEqual({
          kind: "unexpected",
          errorMessage: "totally unrecognized wrapper",
        });
      });

      it("returns unexpected with the raw SDK message when the body isn't valid JSON", async () => {
        const rawSdkMessage = "Received error message from server: [400 Bad Request] not-json {";
        const err = makeSdkApiErrorWithRawBody(400, "not-json {");
        const result = await runWithRejection(err);
        expect(result).toEqual({ kind: "unexpected", errorMessage: rawSdkMessage });
      });

      it("returns unexpected with the raw SDK message when the JSON body has no string `message`", async () => {
        const body = JSON.stringify({ message: null, object: "error" });
        const rawSdkMessage = `Received error message from server: [400 Bad Request] ${body}`;
        const err = makeSdkApiErrorWithRawBody(400, body);
        const result = await runWithRejection(err);
        expect(result).toEqual({ kind: "unexpected", errorMessage: rawSdkMessage });
      });

      it("returns unexpected for non-SDK Error throws (network layer, unrelated exception)", async () => {
        const result = await runWithRejection(new Error("network gone"));
        expect(result).toEqual({ kind: "unexpected", errorMessage: "network gone" });
      });

      it("returns unexpected for unknown (non-Error) throws", async () => {
        const result = await runWithRejection("bare string");
        expect(result).toEqual({ kind: "unexpected", errorMessage: "bare string" });
      });
    });
  });

  describe("getOpenOrgInviteStatus", () => {
    // Pre-stashes an open invite so every non-ok row proves the service-level clear
    // happened alongside its result — a refactor that drops the clear on any variant
    // then fails its row. Ok rows use the same helper to prove the stash survives.
    const prestashOpenInvite = async () => {
      await sut.setOrganizationInvite(createOpenOrgInvite());
    };

    it("returns ok with a mapped non-SSO status on success and leaves the stash intact", async () => {
      organizationInviteLinkApiService.getStatus.mockResolvedValue({
        organizationName: "Acme",
        linksEnabled: true,
        seatsAvailable: true,
        sso: null,
      } as any);
      await prestashOpenInvite();

      const result = await sut.getOpenOrgInviteStatus("org-id", "abc");

      expect(result).toEqual({
        kind: "ok",
        status: {
          organizationName: "Acme",
          sso: null,
        },
      });
      expect(organizationInviteLinkApiService.getStatus).toHaveBeenCalledWith("org-id", "abc");
      expect(await sut.getOrganizationInvite()).not.toBeNull();
    });

    it("returns ok with the SSO config carried through on the mapped status and leaves the stash intact", async () => {
      organizationInviteLinkApiService.getStatus.mockResolvedValue({
        organizationName: "Acme",
        linksEnabled: true,
        seatsAvailable: true,
        sso: { orgSsoId: "acme-sso", required: true },
      } as any);
      await prestashOpenInvite();

      const result = await sut.getOpenOrgInviteStatus("org-id", "abc");

      expect(result.kind).toBe("ok");
      if (result.kind === "ok") {
        expect(result.status.sso).toEqual({ orgSsoId: "acme-sso", required: true });
      }
      expect(await sut.getOrganizationInvite()).not.toBeNull();
    });

    it("returns plan-not-supported with organizationName and clears the stash when linksEnabled is false", async () => {
      organizationInviteLinkApiService.getStatus.mockResolvedValue({
        organizationName: "Acme",
        linksEnabled: false,
        seatsAvailable: true,
        sso: null,
      } as any);
      await prestashOpenInvite();

      const result = await sut.getOpenOrgInviteStatus("org-id", "abc");

      expect(result).toEqual({ kind: "plan-not-supported", organizationName: "Acme" });
      expect(await sut.getOrganizationInvite()).toBeNull();
    });

    it("returns no-seats with organizationName and clears the stash when linksEnabled is true but seatsAvailable is false", async () => {
      organizationInviteLinkApiService.getStatus.mockResolvedValue({
        organizationName: "Acme",
        linksEnabled: true,
        seatsAvailable: false,
        sso: null,
      } as any);
      await prestashOpenInvite();

      const result = await sut.getOpenOrgInviteStatus("org-id", "abc");

      expect(result).toEqual({ kind: "no-seats", organizationName: "Acme" });
      expect(await sut.getOrganizationInvite()).toBeNull();
    });

    it("returns not-found and clears the stash when the server responds with 404", async () => {
      const errorResponse = Object.assign(Object.create(ErrorResponse.prototype), {
        statusCode: 404,
      });
      organizationInviteLinkApiService.getStatus.mockRejectedValue(errorResponse);
      await prestashOpenInvite();

      const result = await sut.getOpenOrgInviteStatus("org-id", "abc");

      expect(result).toEqual({ kind: "not-found" });
      expect(await sut.getOrganizationInvite()).toBeNull();
    });

    it("returns unexpected with the server's message and preserves the stash for unclassified ErrorResponse", async () => {
      const errorResponse = Object.assign(Object.create(ErrorResponse.prototype), {
        statusCode: 500,
        message: "boom",
        getSingleMessage() {
          return "boom";
        },
      });
      organizationInviteLinkApiService.getStatus.mockRejectedValue(errorResponse);
      await prestashOpenInvite();

      const result = await sut.getOpenOrgInviteStatus("org-id", "abc");

      expect(result).toEqual({ kind: "unexpected", errorMessage: "boom" });
      expect(await sut.getOrganizationInvite()).not.toBeNull();
    });

    it("returns unexpected with .message and preserves the stash for non-ErrorResponse Error throws", async () => {
      organizationInviteLinkApiService.getStatus.mockRejectedValue(new Error("network gone"));
      await prestashOpenInvite();

      const result = await sut.getOpenOrgInviteStatus("org-id", "abc");

      expect(result).toEqual({ kind: "unexpected", errorMessage: "network gone" });
      expect(await sut.getOrganizationInvite()).not.toBeNull();
    });

    it("returns unexpected with String(e) and preserves the stash for unknown throws", async () => {
      organizationInviteLinkApiService.getStatus.mockRejectedValue("bare string");
      await prestashOpenInvite();

      const result = await sut.getOpenOrgInviteStatus("org-id", "abc");

      expect(result).toEqual({ kind: "unexpected", errorMessage: "bare string" });
      expect(await sut.getOrganizationInvite()).not.toBeNull();
    });
  });

  describe("validateOpenOrgInviteEmailDomain", () => {
    it("returns allowed when the API reports the email is allowed", async () => {
      organizationInviteLinkApiService.validateEmailDomain.mockResolvedValue({
        isAllowed: true,
      } as any);

      const result = await sut.validateOpenOrgInviteEmailDomain(
        "org-id",
        "abc",
        "user@example.com",
      );

      expect(result).toEqual({ kind: "allowed" });
      expect(organizationInviteLinkApiService.validateEmailDomain).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: "org-id",
          code: "abc",
          email: "user@example.com",
        }),
      );
    });

    it("returns not-allowed when the API reports the email is not allowed", async () => {
      organizationInviteLinkApiService.validateEmailDomain.mockResolvedValue({
        isAllowed: false,
      } as any);

      const result = await sut.validateOpenOrgInviteEmailDomain(
        "org-id",
        "abc",
        "user@example.com",
      );

      expect(result).toEqual({ kind: "not-allowed" });
    });

    it("returns link-invalid when the server responds with 404", async () => {
      const errorResponse = Object.assign(Object.create(ErrorResponse.prototype), {
        statusCode: 404,
      });
      organizationInviteLinkApiService.validateEmailDomain.mockRejectedValue(errorResponse);

      const result = await sut.validateOpenOrgInviteEmailDomain(
        "org-id",
        "abc",
        "user@example.com",
      );

      expect(result).toEqual({ kind: "link-invalid" });
    });

    it("returns unexpected with the server's message for non-404 ErrorResponse", async () => {
      const errorResponse = Object.assign(Object.create(ErrorResponse.prototype), {
        statusCode: 500,
        message: "boom",
        getSingleMessage() {
          return "boom";
        },
      });
      organizationInviteLinkApiService.validateEmailDomain.mockRejectedValue(errorResponse);

      const result = await sut.validateOpenOrgInviteEmailDomain(
        "org-id",
        "abc",
        "user@example.com",
      );

      expect(result).toEqual({ kind: "unexpected", errorMessage: "boom" });
    });

    it("returns unexpected with .message for non-ErrorResponse Error throws", async () => {
      organizationInviteLinkApiService.validateEmailDomain.mockRejectedValue(
        new Error("network gone"),
      );

      const result = await sut.validateOpenOrgInviteEmailDomain(
        "org-id",
        "abc",
        "user@example.com",
      );

      expect(result).toEqual({ kind: "unexpected", errorMessage: "network gone" });
    });

    it("returns unexpected with String(e) for unknown throws", async () => {
      organizationInviteLinkApiService.validateEmailDomain.mockRejectedValue("bare string");

      const result = await sut.validateOpenOrgInviteEmailDomain(
        "org-id",
        "abc",
        "user@example.com",
      );

      expect(result).toEqual({ kind: "unexpected", errorMessage: "bare string" });
    });
  });

  describe("sealed-open-org-invite secret record", () => {
    // TTL constant is 20 * 60 * 1000 (see SEALED_OPEN_ORG_INVITE_SECRET_TTL_MS).
    const TTL_MS = 20 * 60 * 1000;
    // Fixed NOW so the entry-age math in tests is deterministic across environments.
    const NOW = 1_700_000_000_000;

    beforeEach(() => {
      jest.spyOn(Date, "now").mockReturnValue(NOW);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    // Reaches through the underlying `disk-local` record so tests can inspect what the sweep
    // and clear methods actually persist — the service does not expose a raw-record read.
    const readRecord = async (): Promise<
      Record<string, { highEntropySecret: string; createdAtMs: number }> | null | undefined
    > => {
      const state = globalStateProvider.get(EMAIL_SEALED_OPEN_ORG_INVITE_SECRET_RECORD_DISK_LOCAL);
      return firstValueFrom(state.state$);
    };

    // Same reach-through as `readRecord`, used by tests that need to preload state without
    // going through a public write method (there isn't one exposed on the service until
    // the seal path lands).
    const writeRecord = async (
      record: Record<string, { highEntropySecret: string; createdAtMs: number }> | null,
    ): Promise<void> => {
      const state = globalStateProvider.get(EMAIL_SEALED_OPEN_ORG_INVITE_SECRET_RECORD_DISK_LOCAL);
      await state.update(() => record);
    };

    describe("clearSealedOpenOrgInviteSecret", () => {
      it("removes only the targeted email's entry, leaving other entries intact", async () => {
        await writeRecord({
          "a@example.com": { highEntropySecret: "sa", createdAtMs: NOW },
          "b@example.com": { highEntropySecret: "sb", createdAtMs: NOW },
        });
        await sut.clearSealedOpenOrgInviteSecret("a@example.com");
        expect(await readRecord()).toEqual({
          "b@example.com": { highEntropySecret: "sb", createdAtMs: NOW },
        });
      });

      it("is a no-op when the email has no entry", async () => {
        await writeRecord({
          "b@example.com": { highEntropySecret: "sb", createdAtMs: NOW },
        });
        await sut.clearSealedOpenOrgInviteSecret("a@example.com");
        expect(await readRecord()).toEqual({
          "b@example.com": { highEntropySecret: "sb", createdAtMs: NOW },
        });
      });

      it("is a no-op when the record has never been written", async () => {
        await sut.clearSealedOpenOrgInviteSecret("a@example.com");
        expect(await readRecord()).toBeNull();
      });
    });

    describe("sealOpenOrgInvite", () => {
      const validInvite = () => ({
        organizationId: "org-id",
        inviteLinkCode: "code",
        inviteKey: "invite-key",
      });

      it("returns null and skips SDK/state writes when the feature flag is off", async () => {
        configService.getFeatureFlag.mockResolvedValue(false);

        const result = await sut.sealOpenOrgInvite("user@example.com", validInvite());

        expect(result).toBeNull();
        expect(registrationClient.seal_open_org_invite_data).not.toHaveBeenCalled();
        expect(await readRecord()).toBeNull();
      });

      it("returns the sealedData when the flag is on and persists the paired secret keyed by email", async () => {
        configService.getFeatureFlag.mockResolvedValue(true);
        registrationClient.seal_open_org_invite_data.mockReturnValue({
          sealedData: "sealed-blob",
          highEntropySecret: "hes-abc",
        } as any);

        const result = await sut.sealOpenOrgInvite("user@example.com", validInvite());

        expect(result).toEqual("sealed-blob");
        // Domain -> SDK field rename: inviteKey -> inviteSecret.
        expect(registrationClient.seal_open_org_invite_data).toHaveBeenCalledWith({
          organizationId: "org-id",
          inviteLinkCode: "code",
          inviteSecret: "invite-key",
        });
        expect(await readRecord()).toEqual({
          "user@example.com": { highEntropySecret: "hes-abc", createdAtMs: NOW },
        });
      });

      it("overwrites an existing entry for the same email without touching others", async () => {
        configService.getFeatureFlag.mockResolvedValue(true);
        await writeRecord({
          "user@example.com": { highEntropySecret: "old-hes", createdAtMs: NOW - 60_000 },
          "other@example.com": { highEntropySecret: "keep", createdAtMs: NOW - 60_000 },
        });
        registrationClient.seal_open_org_invite_data.mockReturnValue({
          sealedData: "sealed-blob",
          highEntropySecret: "hes-new",
        } as any);

        await sut.sealOpenOrgInvite("user@example.com", validInvite());

        expect(await readRecord()).toEqual({
          "user@example.com": { highEntropySecret: "hes-new", createdAtMs: NOW },
          "other@example.com": { highEntropySecret: "keep", createdAtMs: NOW - 60_000 },
        });
      });
    });

    describe("unsealOpenOrgInvite", () => {
      it("returns { kind: 'secret-miss' } when no secret is stored for the email", async () => {
        const result = await sut.unsealOpenOrgInvite("user@example.com", "sealed-blob");
        expect(result).toEqual({ kind: "secret-miss" });
        expect(registrationClient.unseal_open_org_invite_data).not.toHaveBeenCalled();
      });

      it("returns { kind: 'ok' } with the URL triple on successful SDK unseal", async () => {
        await writeRecord({
          "user@example.com": { highEntropySecret: "hes-abc", createdAtMs: NOW },
        });
        registrationClient.unseal_open_org_invite_data.mockReturnValue({
          organizationId: "org-id",
          inviteLinkCode: "code",
          inviteSecret: "invite-key",
        } as any);

        const result = await sut.unsealOpenOrgInvite("user@example.com", "sealed-blob");

        expect(registrationClient.unseal_open_org_invite_data).toHaveBeenCalledWith({
          sealedData: "sealed-blob",
          highEntropySecret: "hes-abc",
        });
        // SDK -> domain field rename: inviteSecret -> inviteKey. No status fetch here —
        // hydration to OpenOrganizationInvite is the caller's responsibility.
        expect(result).toEqual({
          kind: "ok",
          invite: {
            organizationId: "org-id",
            inviteLinkCode: "code",
            inviteKey: "invite-key",
          },
        });
      });

      it("returns { kind: 'crypto-failure' } when the SDK throws a RegistrationError with Crypto variant", async () => {
        await writeRecord({
          "user@example.com": { highEntropySecret: "hes-abc", createdAtMs: NOW },
        });
        const sdkError = Object.assign(new Error("Cryptography initialization failed"), {
          name: "RegistrationError",
          variant: "Crypto",
        });
        registrationClient.unseal_open_org_invite_data.mockImplementation(() => {
          throw sdkError;
        });

        const result = await sut.unsealOpenOrgInvite("user@example.com", "sealed-blob");
        expect(result).toEqual({ kind: "crypto-failure" });
      });

      it("returns { kind: 'unexpected' } with the message for non-RegistrationError throws", async () => {
        await writeRecord({
          "user@example.com": { highEntropySecret: "hes-abc", createdAtMs: NOW },
        });
        registrationClient.unseal_open_org_invite_data.mockImplementation(() => {
          throw new Error("wasm boundary panic");
        });

        const result = await sut.unsealOpenOrgInvite("user@example.com", "sealed-blob");
        expect(result).toEqual({ kind: "unexpected", errorMessage: "wasm boundary panic" });
      });

      it("returns { kind: 'unexpected' } for a RegistrationError with a non-Crypto variant", async () => {
        await writeRecord({
          "user@example.com": { highEntropySecret: "hes-abc", createdAtMs: NOW },
        });
        const sdkError = Object.assign(new Error("Api call failed"), {
          name: "RegistrationError",
          variant: "Api",
        });
        registrationClient.unseal_open_org_invite_data.mockImplementation(() => {
          throw sdkError;
        });

        const result = await sut.unsealOpenOrgInvite("user@example.com", "sealed-blob");
        expect(result).toEqual({ kind: "unexpected", errorMessage: "Api call failed" });
      });
    });

    describe("email-key normalization at the record boundary", () => {
      // Guards the invariant that every record read/write applies the same normalization
      // (`trim().toLowerCase()`) so seal-side and unseal-side callers key the same entry
      // regardless of case/whitespace differences between the raw form email and the
      // server-canonicalized account email.

      it("sealOpenOrgInvite writes under the normalized email key", async () => {
        configService.getFeatureFlag.mockResolvedValue(true);
        registrationClient.seal_open_org_invite_data.mockReturnValue({
          sealedData: "sealed-blob",
          highEntropySecret: "hes-abc",
        } as any);

        await sut.sealOpenOrgInvite("  Foo@Example.COM  ", {
          organizationId: "org-id",
          inviteLinkCode: "code",
          inviteKey: "invite-key",
        });

        expect(await readRecord()).toEqual({
          "foo@example.com": { highEntropySecret: "hes-abc", createdAtMs: NOW },
        });
      });

      it("unsealOpenOrgInvite finds the stored secret when the caller passes a differently-cased email", async () => {
        await writeRecord({
          "foo@example.com": { highEntropySecret: "hes-abc", createdAtMs: NOW },
        });
        registrationClient.unseal_open_org_invite_data.mockReturnValue({
          organizationId: "org-id",
          inviteLinkCode: "code",
          inviteSecret: "invite-key",
        } as any);
        // unseal now hydrates via the anonymous status endpoint before returning `ok`.
        organizationInviteLinkApiService.getStatus.mockResolvedValue({
          organizationName: "Acme",
          linksEnabled: true,
          seatsAvailable: true,
          sso: null,
        } as any);

        const result = await sut.unsealOpenOrgInvite("Foo@Example.COM", "sealed-blob");

        expect(result.kind).toEqual("ok");
        expect(registrationClient.unseal_open_org_invite_data).toHaveBeenCalledWith({
          sealedData: "sealed-blob",
          highEntropySecret: "hes-abc",
        });
      });

      it("clearSealedOpenOrgInviteSecret removes the normalized entry when given a raw-cased email", async () => {
        await writeRecord({
          "foo@example.com": { highEntropySecret: "hes-abc", createdAtMs: NOW },
          "other@example.com": { highEntropySecret: "keep", createdAtMs: NOW },
        });

        await sut.clearSealedOpenOrgInviteSecret("  Foo@Example.COM  ");

        expect(await readRecord()).toEqual({
          "other@example.com": { highEntropySecret: "keep", createdAtMs: NOW },
        });
      });
    });

    describe("clearExpiredSealedOpenOrgInviteSecrets", () => {
      it("removes entries whose age is strictly greater than the TTL", async () => {
        await writeRecord({
          fresh: { highEntropySecret: "s-fresh", createdAtMs: NOW - 5 * 60 * 1000 },
          expired: { highEntropySecret: "s-expired", createdAtMs: NOW - (TTL_MS + 1) },
        });
        await sut.clearExpiredSealedOpenOrgInviteSecrets();
        expect(await readRecord()).toEqual({
          fresh: { highEntropySecret: "s-fresh", createdAtMs: NOW - 5 * 60 * 1000 },
        });
      });

      it("retains an entry sitting exactly at the TTL boundary (strict > guard)", async () => {
        await writeRecord({
          onBoundary: {
            highEntropySecret: "s-boundary",
            createdAtMs: NOW - TTL_MS,
          },
        });
        await sut.clearExpiredSealedOpenOrgInviteSecrets();
        expect(await readRecord()).toEqual({
          onBoundary: { highEntropySecret: "s-boundary", createdAtMs: NOW - TTL_MS },
        });
      });

      it("leaves the record reference unchanged when no entries are expired", async () => {
        const before = {
          a: { highEntropySecret: "sa", createdAtMs: NOW },
          b: { highEntropySecret: "sb", createdAtMs: NOW - 5 * 60 * 1000 },
        };
        await writeRecord(before);
        await sut.clearExpiredSealedOpenOrgInviteSecrets();
        // Identity check — the impl returns the same ref when nothing expired so
        // the state provider can skip the disk-local write. Content equality alone
        // would silently regress the optimization.
        expect(await readRecord()).toBe(before);
      });

      it("returns a new record reference when at least one entry was expired", async () => {
        const before = {
          fresh: { highEntropySecret: "s-fresh", createdAtMs: NOW - 5 * 60 * 1000 },
          expired: { highEntropySecret: "s-expired", createdAtMs: NOW - (TTL_MS + 1) },
        };
        await writeRecord(before);
        await sut.clearExpiredSealedOpenOrgInviteSecrets();
        // Companion to the "no expiry → same ref" case above: locks in that the
        // impl builds a fresh `next` map when anything expired so the state
        // provider commits a new reference. Content assertions are covered by
        // the "removes entries…" test.
        expect(await readRecord()).not.toBe(before);
      });

      it("is a no-op when the record has never been written", async () => {
        await sut.clearExpiredSealedOpenOrgInviteSecrets();
        expect(await readRecord()).toBeNull();
      });
    });
  });
});

function createOrgInvite(custom: Partial<DirectOrganizationInvite> = {}): DirectOrganizationInvite {
  return new DirectOrganizationInvite({
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

function createOpenOrgInvite(custom: Partial<OpenOrganizationInvite> = {}): OpenOrganizationInvite {
  return new OpenOrganizationInvite({
    organizationId: "org-id",
    inviteLinkCode: "invite-link-code",
    inviteKey: "invite-key",
    organizationName: "Acme",
    ...custom,
  });
}
