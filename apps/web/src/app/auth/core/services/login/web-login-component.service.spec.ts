import { TestBed } from "@angular/core/testing";
import { MockProxy, mock } from "jest-mock-extended";
import { of } from "rxjs";

import { DefaultLoginComponentService } from "@bitwarden/auth/angular";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { InternalPolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { ResetPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/reset-password-policy-options";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/generator-legacy";

// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { RouterService } from "../../../../../../../../apps/web/src/app/core";
import { AcceptOrganizationInviteService } from "../../../organization-invite/accept-organization.service";

import { WebLoginComponentService } from "./web-login-component.service";

jest.mock("../../../../../utils/flags", () => ({
  flagEnabled: jest.fn(),
}));

describe("WebLoginComponentService", () => {
  let service: WebLoginComponentService;
  let acceptOrganizationInviteService: MockProxy<AcceptOrganizationInviteService>;
  let logService: MockProxy<LogService>;
  let policyApiService: MockProxy<PolicyApiServiceAbstraction>;
  let internalPolicyService: MockProxy<InternalPolicyService>;
  let routerService: MockProxy<RouterService>;
  let cryptoFunctionService: MockProxy<CryptoFunctionService>;
  let environmentService: MockProxy<EnvironmentService>;
  let passwordGenerationService: MockProxy<PasswordGenerationServiceAbstraction>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let ssoLoginService: MockProxy<SsoLoginServiceAbstraction>;

  beforeEach(() => {
    acceptOrganizationInviteService = mock<AcceptOrganizationInviteService>();
    logService = mock<LogService>();
    policyApiService = mock<PolicyApiServiceAbstraction>();
    internalPolicyService = mock<InternalPolicyService>();
    routerService = mock<RouterService>();
    cryptoFunctionService = mock<CryptoFunctionService>();
    environmentService = mock<EnvironmentService>();
    passwordGenerationService = mock<PasswordGenerationServiceAbstraction>();
    platformUtilsService = mock<PlatformUtilsService>();
    ssoLoginService = mock<SsoLoginServiceAbstraction>();

    TestBed.configureTestingModule({
      providers: [
        WebLoginComponentService,
        { provide: DefaultLoginComponentService, useClass: WebLoginComponentService },
        { provide: AcceptOrganizationInviteService, useValue: acceptOrganizationInviteService },
        { provide: LogService, useValue: logService },
        { provide: PolicyApiServiceAbstraction, useValue: policyApiService },
        { provide: InternalPolicyService, useValue: internalPolicyService },
        { provide: RouterService, useValue: routerService },
        { provide: CryptoFunctionService, useValue: cryptoFunctionService },
        { provide: EnvironmentService, useValue: environmentService },
        { provide: PasswordGenerationServiceAbstraction, useValue: passwordGenerationService },
        { provide: PlatformUtilsService, useValue: platformUtilsService },
        { provide: SsoLoginServiceAbstraction, useValue: ssoLoginService },
      ],
    });
    service = TestBed.inject(WebLoginComponentService);
  });

  it("creates the service", () => {
    expect(service).toBeTruthy();
  });

  describe("getOrgPoliciesFromOrgInvite", () => {
    it("returns undefined if organization invite is null", async () => {
      acceptOrganizationInviteService.getOrganizationInvite.mockResolvedValue(null);
      const result = await service.getOrgPoliciesFromOrgInvite();
      expect(result).toBeUndefined();
    });

    it("logs an error if getPoliciesByToken throws an error", async () => {
      const error = new Error("Test error");
      acceptOrganizationInviteService.getOrganizationInvite.mockResolvedValue({
        organizationId: "org-id",
        token: "token",
        email: "email",
        organizationUserId: "org-user-id",
        initOrganization: false,
        orgSsoIdentifier: "sso-id",
        orgUserHasExistingUser: false,
        organizationName: "org-name",
      });
      policyApiService.getPoliciesByToken.mockRejectedValue(error);
      await service.getOrgPoliciesFromOrgInvite();
      expect(logService.error).toHaveBeenCalledWith(error);
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

        acceptOrganizationInviteService.getOrganizationInvite.mockResolvedValue({
          organizationId: "org-id",
          token: "token",
          email: "email",
          organizationUserId: "org-user-id",
          initOrganization: false,
          orgSsoIdentifier: "sso-id",
          orgUserHasExistingUser: false,
          organizationName: "org-name",
        });
        policyApiService.getPoliciesByToken.mockResolvedValue(policies);

        internalPolicyService.getResetPasswordPolicyOptions.mockReturnValue([
          resetPasswordPolicyOptions,
          resetPasswordPolicyEnabled,
        ]);

        internalPolicyService.masterPasswordPolicyOptions$.mockReturnValue(
          of(masterPasswordPolicyOptions),
        );

        const result = await service.getOrgPoliciesFromOrgInvite();

        expect(result).toEqual({
          policies: policies,
          isPolicyAndAutoEnrollEnabled:
            resetPasswordPolicyEnabled && resetPasswordPolicyOptions.autoEnrollEnabled,
          enforcedPasswordPolicyOptions: masterPasswordPolicyOptions,
        });
      },
    );
  });
});
