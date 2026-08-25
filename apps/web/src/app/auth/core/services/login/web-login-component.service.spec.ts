import { TestBed } from "@angular/core/testing";
import { MockProxy, mock } from "jest-mock-extended";

import { DefaultLoginComponentService } from "@bitwarden/auth/angular";
import { InternalPolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { ResetPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/reset-password-policy-options";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import {
  DirectOrganizationInvite,
  OpenOrganizationInvite,
  OrganizationInviteService,
} from "@bitwarden/common/auth/organization-invite";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
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
// eslint-disable-next-line no-restricted-imports
import { CryptoFunctionService } from "@bitwarden/legacy-crypto";

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
    const orgInvite = new DirectOrganizationInvite({
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

    it("returns undefined if getOrgPoliciesForInvite returns undefined", async () => {
      organizationInviteService.getOrganizationInvite.mockResolvedValue(orgInvite);
      organizationInviteService.getOrgPoliciesForInvite.mockResolvedValue(undefined);
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
        organizationInviteService.getOrgPoliciesForInvite.mockResolvedValue(policies);

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

    describe("given an open organization invite is in state", () => {
      const openOrgInvite = new OpenOrganizationInvite({
        organizationId: "11111111-1111-1111-1111-111111111111",
        inviteLinkCode: "link-code",
        inviteKey: "link-key",
        organizationName: "Acme Corp",
      });

      it("returns undefined when the GenerateInviteLink flag is off", async () => {
        organizationInviteService.getOrganizationInvite.mockResolvedValue(openOrgInvite);
        configService.getFeatureFlag
          .calledWith(FeatureFlag.GenerateInviteLink)
          .mockResolvedValue(false);

        const result = await service.getOrgPoliciesFromOrgInvite(mockEmail);

        expect(result).toBeUndefined();
        expect(organizationInviteService.getOrgPoliciesForInvite).not.toHaveBeenCalled();
      });

      it("returns PasswordPolicies when flag is on", async () => {
        const policies: Policy[] = [new Policy()];
        const masterPasswordPolicyOptions = new MasterPasswordPolicyOptions();
        const resetPasswordPolicyOptions = new ResetPasswordPolicyOptions();

        organizationInviteService.getOrganizationInvite.mockResolvedValue(openOrgInvite);
        configService.getFeatureFlag
          .calledWith(FeatureFlag.GenerateInviteLink)
          .mockResolvedValue(true);
        organizationInviteService.getOrgPoliciesForInvite.mockResolvedValue(policies);
        internalPolicyService.getResetPasswordPolicyOptions.mockReturnValue([
          resetPasswordPolicyOptions,
          false,
        ]);
        internalPolicyService.combinePoliciesIntoMasterPasswordPolicyOptions.mockReturnValue(
          masterPasswordPolicyOptions,
        );

        const result = await service.getOrgPoliciesFromOrgInvite(mockEmail);

        expect(result).toEqual({
          policies,
          isPolicyAndAutoEnrollEnabled: false,
          enforcedPasswordPolicyOptions: masterPasswordPolicyOptions,
        });
      });
    });
  });

  describe("handleQueryParamErrors", () => {
    const mockOrganizationName = "Acme Corp";
    const mockOrganizationId = "11111111-1111-1111-1111-111111111111";
    const otherOrganizationId = "22222222-2222-2222-2222-222222222222";
    const mockEmail = "test@example.com";

    const directOrgInviteFor = (overrides: { email?: string; organizationId?: string } = {}) =>
      new DirectOrganizationInvite({
        organizationId: overrides.organizationId ?? mockOrganizationId,
        token: "token",
        email: overrides.email ?? mockEmail,
        organizationUserId: "org-user-id",
        initOrganization: false,
        orgSsoIdentifier: "sso-id",
        orgUserHasExistingUser: false,
        organizationName: mockOrganizationName,
      });

    const openOrgInviteFor = (overrides: { organizationId?: string } = {}) =>
      new OpenOrganizationInvite({
        organizationId: overrides.organizationId ?? mockOrganizationId,
        inviteLinkCode: "link-code",
        inviteKey: "link-key",
        organizationName: mockOrganizationName,
      });

    // Both SSO redirect error codes share the same client-side match/no-match handler
    // (server intent differs but the client's response is identical). `describe.each`
    // enforces parity by construction so a future divergence (either code getting its
    // own case body) requires an explicit split rather than a silent copy-paste.
    describe.each(["ssoOrgInviteAcceptanceRequired", "ssoOrgMembershipRequired"] as const)(
      "when error code is %s",
      (errorCode) => {
        const paramsFor = (overrides: Partial<Record<string, string>> = {}) => ({
          error: errorCode,
          organizationId: mockOrganizationId,
          organizationName: mockOrganizationName,
          email: mockEmail,
          ...overrides,
        });

        describe("with a matching stashed invite", () => {
          it("auto-progresses to MP entry with the join-org layout when a direct invite matches on org id + email", async () => {
            organizationInviteService.getOrganizationInvite.mockResolvedValue(directOrgInviteFor());

            const result = await service.handleQueryParamErrors(paramsFor());

            expect(result.autoSubmit).toBe(true);
            expect(result.mpEntryLayoutOverride).toEqual({
              pageTitle: { key: "joinOrganizationName", placeholders: [mockOrganizationName] },
              pageSubtitle: { key: "acceptInviteWithMasterPassword" },
              pageIcon: expect.anything(),
            });
            expect(toastService.showToast).not.toHaveBeenCalled();
          });

          it("treats the direct-invite email match as case-insensitive", async () => {
            organizationInviteService.getOrganizationInvite.mockResolvedValue(
              directOrgInviteFor({ email: "User@Example.com" }),
            );

            const result = await service.handleQueryParamErrors(
              paramsFor({ email: "user@example.com" }),
            );

            expect(result.autoSubmit).toBe(true);
            expect(result.mpEntryLayoutOverride).toBeDefined();
            expect(toastService.showToast).not.toHaveBeenCalled();
          });

          it("auto-progresses to MP entry when an open invite matches on org id", async () => {
            organizationInviteService.getOrganizationInvite.mockResolvedValue(openOrgInviteFor());

            const result = await service.handleQueryParamErrors(paramsFor());

            expect(result.autoSubmit).toBe(true);
            expect(toastService.showToast).not.toHaveBeenCalled();
          });
        });

        describe("with no matching stashed invite", () => {
          it("shows the shared warning toast when no invite is stashed", async () => {
            organizationInviteService.getOrganizationInvite.mockResolvedValue(null);
            i18nService.t.mockReturnValue("translated message");

            const result = await service.handleQueryParamErrors(paramsFor());

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

          it("shows the shared warning toast when a stashed direct invite's email doesn't match", async () => {
            organizationInviteService.getOrganizationInvite.mockResolvedValue(
              directOrgInviteFor({ email: "other@example.com" }),
            );

            const result = await service.handleQueryParamErrors(paramsFor());

            expect(result).toEqual({ autoSubmit: false });
            expect(toastService.showToast).toHaveBeenCalled();
          });

          it("shows the shared warning toast when a stashed direct invite's org id doesn't match", async () => {
            // User has Org A's invite stashed but is being redirected for Org B (same email).
            // We must not auto-progress, because the deep-link guard would replay Org A's
            // /accept-organization while the UI claims they're joining Org B.
            organizationInviteService.getOrganizationInvite.mockResolvedValue(
              directOrgInviteFor({ organizationId: otherOrganizationId }),
            );

            const result = await service.handleQueryParamErrors(paramsFor());

            expect(result).toEqual({ autoSubmit: false });
            expect(toastService.showToast).toHaveBeenCalled();
          });

          it("shows the shared warning toast when a stashed open invite's org id doesn't match", async () => {
            organizationInviteService.getOrganizationInvite.mockResolvedValue(
              openOrgInviteFor({ organizationId: otherOrganizationId }),
            );

            const result = await service.handleQueryParamErrors(paramsFor());

            expect(result).toEqual({ autoSubmit: false });
            expect(toastService.showToast).toHaveBeenCalled();
          });
        });

        describe.each(["organizationName", "organizationId", "email"] as const)(
          "with the %s query param missing",
          (missingParam) => {
            it("returns autoSubmit=false without reading the stash or firing a toast", async () => {
              const paramsWithout = { ...paramsFor() };
              delete paramsWithout[missingParam];

              const result = await service.handleQueryParamErrors(paramsWithout);

              expect(result).toEqual({ autoSubmit: false });
              expect(organizationInviteService.getOrganizationInvite).not.toHaveBeenCalled();
              expect(toastService.showToast).not.toHaveBeenCalled();
            });
          },
        );
      },
    );

    describe("when the error code is unrecognized or absent", () => {
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

      it("returns autoSubmit=false with no toast when the error param is absent", async () => {
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
