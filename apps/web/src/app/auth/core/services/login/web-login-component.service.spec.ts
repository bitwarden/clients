import { TestBed } from "@angular/core/testing";
import { MockProxy, mock } from "jest-mock-extended";

import { DefaultLoginComponentService } from "@bitwarden/auth/angular";
import { InternalPolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { ResetPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/reset-password-policy-options";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { OrganizationInvite } from "@bitwarden/common/auth/organization-invite/organization-invite";
import { OrganizationInviteService } from "@bitwarden/common/auth/organization-invite/organization-invite.service";
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { ToastService } from "@bitwarden/components";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/generator-legacy";

// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { RouterService } from "../../../../../../../../apps/web/src/app/core";

import { WebLoginComponentService } from "./web-login-component.service";

jest.mock("../../../../../utils/flags", () => ({
  flagEnabled: jest.fn(),
}));

describe("WebLoginComponentService", () => {
  let service: WebLoginComponentService;
  let organizationInviteService: MockProxy<OrganizationInviteService>;
  let logService: MockProxy<LogService>;
  let internalPolicyService: MockProxy<InternalPolicyService>;
  let routerService: MockProxy<RouterService>;
  let cryptoFunctionService: MockProxy<CryptoFunctionService>;
  let environmentService: MockProxy<EnvironmentService>;
  let passwordGenerationService: MockProxy<PasswordGenerationServiceAbstraction>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let ssoLoginService: MockProxy<SsoLoginServiceAbstraction>;
  const mockUserId = Utils.newGuid() as UserId;
  let accountService: FakeAccountService;
  let configService: MockProxy<ConfigService>;
  let toastService: MockProxy<ToastService>;
  let i18nService: MockProxy<I18nService>;

  beforeEach(() => {
    organizationInviteService = mock<OrganizationInviteService>();
    logService = mock<LogService>();
    internalPolicyService = mock<InternalPolicyService>();
    routerService = mock<RouterService>();
    cryptoFunctionService = mock<CryptoFunctionService>();
    environmentService = mock<EnvironmentService>();
    passwordGenerationService = mock<PasswordGenerationServiceAbstraction>();
    platformUtilsService = mock<PlatformUtilsService>();
    ssoLoginService = mock<SsoLoginServiceAbstraction>();
    accountService = mockAccountServiceWith(mockUserId);
    configService = mock<ConfigService>();
    toastService = mock<ToastService>();
    i18nService = mock<I18nService>();

    TestBed.configureTestingModule({
      providers: [
        WebLoginComponentService,
        { provide: DefaultLoginComponentService, useClass: WebLoginComponentService },
        { provide: OrganizationInviteService, useValue: organizationInviteService },
        { provide: LogService, useValue: logService },
        { provide: InternalPolicyService, useValue: internalPolicyService },
        { provide: RouterService, useValue: routerService },
        { provide: CryptoFunctionService, useValue: cryptoFunctionService },
        { provide: EnvironmentService, useValue: environmentService },
        { provide: PasswordGenerationServiceAbstraction, useValue: passwordGenerationService },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        { provide: SsoLoginServiceAbstraction, useValue: ssoLoginService },
        { provide: AccountService, useValue: accountService },
        { provide: ConfigService, useValue: configService },
        { provide: ToastService, useValue: toastService },
        { provide: I18nService, useValue: i18nService },
      ],
    });
    service = TestBed.inject(WebLoginComponentService);
  });

  it("creates the service", () => {
    expect(service).toBeTruthy();
  });

  describe("getOrgPoliciesFromOrgInvite", () => {
    const mockEmail = "test@example.com";
    const orgInvite = new OrganizationInvite({
      organizationId: "org-id",
      token: "token",
      email: mockEmail,
      organizationUserId: "org-user-id",
      initOrganization: false,
      orgSsoIdentifier: "sso-id",
      orgUserHasExistingUser: false,
      organizationName: "org-name",
    });

    it("returns undefined if organization invite is null", async () => {
      organizationInviteService.getOrganizationInvite.mockResolvedValue(null);
      const result = await service.getOrgPoliciesFromOrgInvite(mockEmail);
      expect(result).toBeUndefined();
    });

    it("returns undefined if getInvitePolicies returns undefined", async () => {
      organizationInviteService.getOrganizationInvite.mockResolvedValue(orgInvite);
      organizationInviteService.getInvitePolicies.mockResolvedValue(undefined);
      const result = await service.getOrgPoliciesFromOrgInvite(mockEmail);
      expect(result).toBeUndefined();
    });

    it.each([
      [false, false], // autoEnrollEnabled, resetPasswordPolicyEnabled
      [true, true], // autoEnrollEnabled, resetPasswordPolicyEnabled
    ])(
      "returns policies successfully with autoEnrollEnabled=%s and resetPasswordPolicyEnabled=%s",
      async (autoEnrollEnabled, resetPasswordPolicyEnabled) => {
        const policies: Policy[] = [new Policy()];
        const masterPasswordPolicyOptions = new MasterPasswordPolicyOptions();
        const resetPasswordPolicyOptions = new ResetPasswordPolicyOptions();
        resetPasswordPolicyOptions.autoEnrollEnabled = autoEnrollEnabled;

        organizationInviteService.getOrganizationInvite.mockResolvedValue(orgInvite);
        organizationInviteService.getInvitePolicies.mockResolvedValue(policies);

        internalPolicyService.getResetPasswordPolicyOptions.mockReturnValue([
          resetPasswordPolicyOptions,
          resetPasswordPolicyEnabled,
        ]);

        internalPolicyService.combinePoliciesIntoMasterPasswordPolicyOptions.mockReturnValue(
          masterPasswordPolicyOptions,
        );

        const result = await service.getOrgPoliciesFromOrgInvite(mockEmail);

        expect(result).toEqual({
          policies: policies,
          isPolicyAndAutoEnrollEnabled:
            resetPasswordPolicyEnabled && resetPasswordPolicyOptions.autoEnrollEnabled,
          enforcedPasswordPolicyOptions: masterPasswordPolicyOptions,
        });
      },
    );

    describe("given the orgInvite email does not match the provided email", () => {
      const mockMismatchedEmail = "mismatched@example.com";
      it("should clear the login redirect URL and organization invite", async () => {
        // Arrange
        organizationInviteService.getOrganizationInvite.mockResolvedValue({
          ...orgInvite,
          email: mockMismatchedEmail,
        });

        // Act
        await service.getOrgPoliciesFromOrgInvite(mockEmail);

        // Assert
        expect(routerService.getAndClearLoginRedirectUrl).toHaveBeenCalledTimes(1);
        expect(organizationInviteService.clearOrganizationInvite).toHaveBeenCalledTimes(1);
      });

      it("should log an error and return undefined", async () => {
        // Arrange
        organizationInviteService.getOrganizationInvite.mockResolvedValue({
          ...orgInvite,
          email: mockMismatchedEmail,
        });

        // Act
        const result = await service.getOrgPoliciesFromOrgInvite(mockEmail);

        // Assert
        expect(logService.error).toHaveBeenCalledWith(
          `WebLoginComponentService.getOrgPoliciesFromOrgInvite: Email mismatch. Expected: ${mockMismatchedEmail}, Received: ${mockEmail}`,
        );
        expect(result).toBeUndefined();
      });
    });
  });

  describe("handleQueryParamErrors", () => {
    const mockOrganizationName = "Acme Corp";
    const mockOrganizationId = "11111111-1111-1111-1111-111111111111";
    const mockEmail = "test@example.com";
    const orgInviteFor = (overrides: { email?: string; organizationId?: string } = {}) =>
      new OrganizationInvite({
        organizationId: overrides.organizationId ?? mockOrganizationId,
        token: "token",
        email: overrides.email ?? mockEmail,
        organizationUserId: "org-user-id",
        initOrganization: false,
        orgSsoIdentifier: "sso-id",
        orgUserHasExistingUser: false,
        organizationName: mockOrganizationName,
      });

    describe("when error code is ssoOrgInviteAcceptanceRequired", () => {
      it("returns autoSubmit=true with the MP-entry layout override when stash org id + email match", async () => {
        organizationInviteService.getOrganizationInvite.mockResolvedValue(orgInviteFor());

        const result = await service.handleQueryParamErrors({
          error: "ssoOrgInviteAcceptanceRequired",
          organizationId: mockOrganizationId,
          organizationName: mockOrganizationName,
          email: mockEmail,
        });

        expect(result.autoSubmit).toBe(true);
        expect(result.mpEntryLayoutOverride).toEqual({
          pageTitle: { key: "joinOrganizationName", placeholders: [mockOrganizationName] },
          pageSubtitle: { key: "acceptInviteWithMasterPassword" },
          pageIcon: expect.anything(),
        });
        expect(toastService.showToast).not.toHaveBeenCalled();
      });

      it("treats email match as case-insensitive", async () => {
        organizationInviteService.getOrganizationInvite.mockResolvedValue(
          orgInviteFor({ email: "User@Example.com" }),
        );

        const result = await service.handleQueryParamErrors({
          error: "ssoOrgInviteAcceptanceRequired",
          organizationId: mockOrganizationId,
          organizationName: mockOrganizationName,
          email: "user@example.com",
        });

        expect(result.autoSubmit).toBe(true);
        expect(result.mpEntryLayoutOverride).toBeDefined();
        expect(toastService.showToast).not.toHaveBeenCalled();
      });

      it("returns autoSubmit=false and fires the warning toast when no invite is stashed", async () => {
        organizationInviteService.getOrganizationInvite.mockResolvedValue(null);
        i18nService.t.mockReturnValue("translated message");

        const result = await service.handleQueryParamErrors({
          error: "ssoOrgInviteAcceptanceRequired",
          organizationId: mockOrganizationId,
          organizationName: mockOrganizationName,
          email: mockEmail,
        });

        expect(result).toEqual({ autoSubmit: false });
        expect(i18nService.t).toHaveBeenCalledWith(
          "ssoLoginRequiresInviteAcceptance",
          mockOrganizationName,
        );
        expect(toastService.showToast).toHaveBeenCalledWith({
          variant: "warning",
          title: null,
          message: "translated message",
          timeout: 10000,
        });
      });

      it("returns autoSubmit=false and fires the warning toast when the stash email does not match", async () => {
        organizationInviteService.getOrganizationInvite.mockResolvedValue(
          orgInviteFor({ email: "other@example.com" }),
        );

        const result = await service.handleQueryParamErrors({
          error: "ssoOrgInviteAcceptanceRequired",
          organizationId: mockOrganizationId,
          organizationName: mockOrganizationName,
          email: mockEmail,
        });

        expect(result).toEqual({ autoSubmit: false });
        expect(toastService.showToast).toHaveBeenCalled();
      });

      it("returns autoSubmit=false and fires the warning toast when the stash org id does not match", async () => {
        // User has Org A's invite stashed but is being redirected for Org B (same email).
        // We must not auto-progress, because the deep-link guard would replay Org A's
        // /accept-organization while the UI claims they're joining Org B.
        organizationInviteService.getOrganizationInvite.mockResolvedValue(
          orgInviteFor({ organizationId: "22222222-2222-2222-2222-222222222222" }),
        );

        const result = await service.handleQueryParamErrors({
          error: "ssoOrgInviteAcceptanceRequired",
          organizationId: mockOrganizationId,
          organizationName: mockOrganizationName,
          email: mockEmail,
        });

        expect(result).toEqual({ autoSubmit: false });
        expect(toastService.showToast).toHaveBeenCalled();
      });

      it("does nothing when organizationName is missing", async () => {
        const result = await service.handleQueryParamErrors({
          error: "ssoOrgInviteAcceptanceRequired",
          organizationId: mockOrganizationId,
          email: mockEmail,
        });

        expect(result).toEqual({ autoSubmit: false });
        expect(organizationInviteService.getOrganizationInvite).not.toHaveBeenCalled();
        expect(toastService.showToast).not.toHaveBeenCalled();
      });

      it("does nothing when organizationId is missing", async () => {
        const result = await service.handleQueryParamErrors({
          error: "ssoOrgInviteAcceptanceRequired",
          organizationName: mockOrganizationName,
          email: mockEmail,
        });

        expect(result).toEqual({ autoSubmit: false });
        expect(organizationInviteService.getOrganizationInvite).not.toHaveBeenCalled();
        expect(toastService.showToast).not.toHaveBeenCalled();
      });

      it("does nothing when the email query param is missing", async () => {
        const result = await service.handleQueryParamErrors({
          error: "ssoOrgInviteAcceptanceRequired",
          organizationId: mockOrganizationId,
          organizationName: mockOrganizationName,
        });

        expect(result).toEqual({ autoSubmit: false });
        expect(organizationInviteService.getOrganizationInvite).not.toHaveBeenCalled();
        expect(toastService.showToast).not.toHaveBeenCalled();
      });
    });

    describe("when error code is ssoOrgMembershipRequired", () => {
      // The OrgMembershipRequired lane shares the same client-side match/no-match
      // handler as InviteAcceptanceRequired (via switch fall-through), so we cover
      // the key shapes here rather than duplicating the full InviteAcceptanceRequired
      // suite. These tests pin the fall-through wiring so a future split (where a
      // lane gets its own case body) is caught by the existing test names changing.

      it("returns autoSubmit=true with the MP-entry layout override when stash org id + email match", async () => {
        organizationInviteService.getOrganizationInvite.mockResolvedValue(orgInviteFor());

        const result = await service.handleQueryParamErrors({
          error: "ssoOrgMembershipRequired",
          organizationId: mockOrganizationId,
          organizationName: mockOrganizationName,
          email: mockEmail,
        });

        expect(result.autoSubmit).toBe(true);
        expect(result.mpEntryLayoutOverride).toEqual({
          pageTitle: { key: "joinOrganizationName", placeholders: [mockOrganizationName] },
          pageSubtitle: { key: "acceptInviteWithMasterPassword" },
          pageIcon: expect.anything(),
        });
        expect(toastService.showToast).not.toHaveBeenCalled();
      });

      it("returns autoSubmit=false and reuses the existing invite-acceptance toast when no invite is stashed", async () => {
        // Existing user with no pending invite attempting SSO. The shared toast
        // covers both this and the stale/wrong-org stash edge case (the server
        // can't distinguish them), so we assert the same key fires.
        organizationInviteService.getOrganizationInvite.mockResolvedValue(null);
        i18nService.t.mockReturnValue("translated message");

        const result = await service.handleQueryParamErrors({
          error: "ssoOrgMembershipRequired",
          organizationId: mockOrganizationId,
          organizationName: mockOrganizationName,
          email: mockEmail,
        });

        expect(result).toEqual({ autoSubmit: false });
        expect(i18nService.t).toHaveBeenCalledWith(
          "ssoLoginRequiresInviteAcceptance",
          mockOrganizationName,
        );
        expect(toastService.showToast).toHaveBeenCalledWith({
          variant: "warning",
          title: null,
          message: "translated message",
          timeout: 10000,
        });
      });

      it("returns autoSubmit=false and fires the warning toast when the stash org id does not match", async () => {
        // Stale or wrong-org stash — fall through to the shared no-match path so the
        // user isn't auto-progressed for a different org.
        organizationInviteService.getOrganizationInvite.mockResolvedValue(
          orgInviteFor({ organizationId: "22222222-2222-2222-2222-222222222222" }),
        );

        const result = await service.handleQueryParamErrors({
          error: "ssoOrgMembershipRequired",
          organizationId: mockOrganizationId,
          organizationName: mockOrganizationName,
          email: mockEmail,
        });

        expect(result).toEqual({ autoSubmit: false });
        expect(toastService.showToast).toHaveBeenCalled();
      });
    });

    describe("when error code is unrecognized or missing", () => {
      it("returns autoSubmit=false with no toast for an unknown error code", async () => {
        const result = await service.handleQueryParamErrors({
          error: "someUnknownErrorCode",
          organizationId: mockOrganizationId,
          organizationName: mockOrganizationName,
          email: mockEmail,
        });

        expect(result).toEqual({ autoSubmit: false });
        expect(toastService.showToast).not.toHaveBeenCalled();
      });

      it("returns autoSubmit=false when the error param is absent", async () => {
        const result = await service.handleQueryParamErrors({
          organizationId: mockOrganizationId,
          organizationName: mockOrganizationName,
          email: mockEmail,
        });

        expect(result).toEqual({ autoSubmit: false });
        expect(toastService.showToast).not.toHaveBeenCalled();
      });
    });
  });
});
