import { TestBed } from "@angular/core/testing";
import { UrlTree } from "@angular/router";

import { DefaultLoginComponentService } from "@bitwarden/auth/angular";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/policy/policy-api.service.abstraction";
import { InternalPolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { RouterService } from "../../../../../../../../apps/web/src/app/core";
import { flagEnabled } from "../../../../../utils/flags";
import { AcceptOrganizationInviteService } from "../../../organization-invite/accept-organization.service";

import { WebLoginComponentService } from "./web-login-component.service";

jest.mock("../../../../../utils/flags", () => ({
  flagEnabled: jest.fn(),
}));

describe("WebLoginComponentService", () => {
  let service: WebLoginComponentService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        WebLoginComponentService,
        { provide: DefaultLoginComponentService, useClass: WebLoginComponentService },
        {
          provide: AcceptOrganizationInviteService,
          useValue: {
            getOrganizationInvite: jest.fn(),
          },
        },
        {
          provide: LogService,
          useValue: {
            error: jest.fn(),
          },
        },
        {
          provide: PolicyApiServiceAbstraction,
          useValue: {
            getPoliciesByToken: jest.fn(),
          },
        },
        { provide: InternalPolicyService, useValue: {} },
        {
          provide: RouterService,
          useValue: {
            setPreviousUrl: jest.fn(),
          },
        },
      ],
    });
    service = TestBed.inject(WebLoginComponentService);
  });

  it("creates the service", () => {
    expect(service).toBeTruthy();
  });

  describe("isLoginViaAuthRequestSupported", () => {
    it("returns true if showPasswordless flag is enabled", () => {
      (flagEnabled as jest.Mock).mockReturnValue(true);
      expect(service.isLoginViaAuthRequestSupported()).toBe(true);
    });

    it("returns false if showPasswordless flag is disabled", () => {
      (flagEnabled as jest.Mock).mockReturnValue(false);
      expect(service.isLoginViaAuthRequestSupported()).toBeFalsy();
    });
  });

  it("sets the previous URL", () => {
    const route = { toString: () => "test-url" } as UrlTree;
    const routerServiceSpy = jest.spyOn(service.routerService, "setPreviousUrl");
    service.setPreviousUrl(route);
    expect(routerServiceSpy).toHaveBeenCalledWith("test-url");
  });

  it("returns undefined if organization invite is null", async () => {
    jest
      .spyOn(service.acceptOrganizationInviteService, "getOrganizationInvite")
      .mockResolvedValue(null);
    const result = await service.getOrgPolicies();
    expect(result).toBeUndefined();
  });

  it("logs an error if getPoliciesByToken throws an error", async () => {
    const error = new Error("Test error");
    jest.spyOn(service.acceptOrganizationInviteService, "getOrganizationInvite").mockResolvedValue({
      organizationId: "org-id",
      token: "token",
      email: "email",
      organizationUserId: "org-user-id",
      initOrganization: false,
      orgSsoIdentifier: "sso-id",
      orgUserHasExistingUser: false,
      organizationName: "org-name",
    });
    jest.spyOn(service.policyApiService, "getPoliciesByToken").mockRejectedValue(error);
    const logServiceSpy = jest.spyOn(service.logService, "error");
    await service.getOrgPolicies();
    expect(logServiceSpy).toHaveBeenCalledWith(error);
  });
});
