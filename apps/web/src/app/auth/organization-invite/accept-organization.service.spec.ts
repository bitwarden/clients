// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { FakeGlobalStateProvider } from "@bitwarden/common/../spec/fake-state-provider";
import { MockProxy, mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { OrganizationUserApiService } from "@bitwarden/admin-console/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { ResetPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/reset-password-policy-options";
import { OrganizationKeysResponse } from "@bitwarden/common/admin-console/models/response/organization-keys.response";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { FakeGlobalState } from "@bitwarden/common/spec/fake-state";
import { OrgKey } from "@bitwarden/common/types/key";
import { DialogService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

import { I18nService } from "../../core/i18n.service";

import {
  AcceptOrganizationInviteService,
  ORGANIZATION_INVITE,
} from "./accept-organization.service";
import { OrganizationInvite } from "./organization-invite";

describe("AcceptOrganizationInviteService", () => {
  let sut: AcceptOrganizationInviteService;
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
  let globalState: FakeGlobalState<OrganizationInvite>;
  let dialogService: MockProxy<DialogService>;
  let accountService: MockProxy<AccountService>;

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
    globalState = globalStateProvider.getFake(ORGANIZATION_INVITE);
    dialogService = mock();
    accountService = mock();

    sut = new AcceptOrganizationInviteService(
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
      dialogService,
      accountService,
    );
  });

  describe("validateAndAcceptInvite", () => {
    it("initializes an organization when given an invite where initOrganization is true", async () => {
      keyService.makeOrgKey.mockResolvedValue([
        { encryptedString: "string" } as EncString,
        "orgPrivateKey" as unknown as OrgKey,
      ]);
      keyService.makeKeyPair.mockResolvedValue([
        "orgPublicKey",
        { encryptedString: "string" } as EncString,
      ]);
      encryptService.wrapDecapsulationKey.mockResolvedValue({
        encryptedString: "string",
      } as EncString);
      encryptService.encryptString.mockResolvedValue({ encryptedString: "string" } as EncString);
      const invite = createOrgInvite({ initOrganization: true });

      const result = await sut.validateAndAcceptInvite(invite);

      expect(result).toBe(true);
      expect(organizationUserApiService.postOrganizationUserAcceptInit).toHaveBeenCalled();
      expect(apiService.refreshIdentityToken).toHaveBeenCalled();
      expect(globalState.nextMock).toHaveBeenCalledWith(null);
      expect(organizationUserApiService.postOrganizationUserAccept).not.toHaveBeenCalled();
      expect(authService.logOut).not.toHaveBeenCalled();
    });

    it("logs out the user and stores the invite when a master password policy check is required", async () => {
      const invite = createOrgInvite();
      policyApiService.getPoliciesByToken.mockResolvedValue([
        {
          type: PolicyType.MasterPassword,
          enabled: true,
        } as Policy,
      ]);

      const result = await sut.validateAndAcceptInvite(invite);

      expect(result).toBe(false);
      expect(authService.logOut).toHaveBeenCalled();
      expect(globalState.nextMock).toHaveBeenCalledWith(invite);
    });

    it("clears the stored invite when a master password policy check is required but the stored invite doesn't match the provided one", async () => {
      const storedInvite = createOrgInvite({ email: "wrongemail@example.com" });
      const providedInvite = createOrgInvite();
      await globalState.update(() => storedInvite);
      policyApiService.getPoliciesByToken.mockResolvedValue([
        {
          type: PolicyType.MasterPassword,
          enabled: true,
        } as Policy,
      ]);

      const result = await sut.validateAndAcceptInvite(providedInvite);

      expect(result).toBe(false);
      expect(authService.logOut).toHaveBeenCalled();
      expect(globalState.nextMock).toHaveBeenCalledWith(providedInvite);
    });

    it("accepts the invitation request when the organization doesn't have a master password policy", async () => {
      const invite = createOrgInvite();
      policyApiService.getPoliciesByToken.mockResolvedValue([]);

      const result = await sut.validateAndAcceptInvite(invite);

      expect(result).toBe(true);
      expect(organizationUserApiService.postOrganizationUserAccept).toHaveBeenCalled();
      expect(apiService.refreshIdentityToken).toHaveBeenCalled();
      expect(globalState.nextMock).toHaveBeenCalledWith(null);
      expect(organizationUserApiService.postOrganizationUserAcceptInit).not.toHaveBeenCalled();
      expect(authService.logOut).not.toHaveBeenCalled();
    });

    it("accepts the invitation request when the org has a master password policy, but the user has already passed it and autoenroll is not enabled", async () => {
      const invite = createOrgInvite();
      policyApiService.getPoliciesByToken.mockResolvedValue([
        {
          type: PolicyType.MasterPassword,
          enabled: true,
        } as Policy,
      ]);
      // an existing invite means the user has already passed the master password policy
      await globalState.update(() => invite);

      policyService.getResetPasswordPolicyOptions.mockReturnValue([
        {
          autoEnrollEnabled: false,
        } as ResetPasswordPolicyOptions,
        false,
      ]);

      const result = await sut.validateAndAcceptInvite(invite);

      expect(result).toBe(true);
      expect(organizationUserApiService.postOrganizationUserAccept).toHaveBeenCalled();
      expect(organizationUserApiService.postOrganizationUserAcceptInit).not.toHaveBeenCalled();
      expect(authService.logOut).not.toHaveBeenCalled();
    });

    it("accepts the invitation request and enrolls when autoenroll is enabled", async () => {
      const invite = createOrgInvite();
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
      accountService.activeAccount$ = new BehaviorSubject({ id: "activeUserId" }) as any;
      keyService.userKey$.mockReturnValue(new BehaviorSubject({ key: "userKey" } as any));
      encryptService.encapsulateKeyUnsigned.mockResolvedValue({
        encryptedString: "encryptedString",
      } as EncString);

      await globalState.update(() => invite);

      policyService.getResetPasswordPolicyOptions.mockReturnValue([
        {
          autoEnrollEnabled: true,
        } as ResetPasswordPolicyOptions,
        true,
      ]);

      const result = await sut.validateAndAcceptInvite(invite);

      expect(result).toBe(true);
      expect(encryptService.encapsulateKeyUnsigned).toHaveBeenCalledWith(
        { key: "userKey" },
        Utils.fromB64ToArray("publicKey"),
      );
      expect(organizationUserApiService.postOrganizationUserAccept).toHaveBeenCalled();
      expect(organizationUserApiService.postOrganizationUserAcceptInit).not.toHaveBeenCalled();
      expect(authService.logOut).not.toHaveBeenCalled();
    });
  });
});

function createOrgInvite(custom: Partial<OrganizationInvite> = {}): OrganizationInvite {
  return Object.assign(
    {
      email: "user@example.com",
      initOrganization: false,
      orgSsoIdentifier: null,
      orgUserHasExistingUser: false,
      organizationId: "organizationId",
      organizationName: "organizationName",
      organizationUserId: "organizationUserId",
      token: "token",
    },
    custom,
  );
}
