import { MockProxy, mock } from "jest-mock-extended";

import {
  DirectOrganizationInvite,
  OrganizationInviteService,
} from "@bitwarden/common/auth/organization-invite";

import { RouterService } from "../../../../core/router.service";

import { WebLoginDecryptionOptionsService } from "./web-login-decryption-options.service";

describe("WebLoginDecryptionOptionsService", () => {
  let service: WebLoginDecryptionOptionsService;

  let routerService: MockProxy<RouterService>;
  let organizationInviteService: MockProxy<OrganizationInviteService>;

  beforeEach(() => {
    routerService = mock<RouterService>();
    organizationInviteService = mock<OrganizationInviteService>();

    service = new WebLoginDecryptionOptionsService(routerService, organizationInviteService);
  });

  it("should instantiate the service", () => {
    expect(service).not.toBeFalsy();
  });

  describe("handleCreateUserSuccess()", () => {
    it("should clear the redirect URL and the org invite when an org invite is stashed", async () => {
      organizationInviteService.getOrganizationInvite.mockResolvedValue(
        new DirectOrganizationInvite({
          organizationId: "org-id",
          token: "token",
          email: "test@example.com",
          organizationUserId: "org-user-id",
          initOrganization: false,
          orgSsoIdentifier: "sso-id",
          orgUserHasExistingUser: false,
          organizationName: "org-name",
        }),
      );

      await service.handleCreateUserSuccess();

      expect(routerService.getAndClearLoginRedirectUrl).toHaveBeenCalled();
      expect(organizationInviteService.clearOrganizationInvite).toHaveBeenCalled();
    });

    it("should NOT clear the redirect URL or the org invite when no org invite is stashed", async () => {
      organizationInviteService.getOrganizationInvite.mockResolvedValue(null);

      await service.handleCreateUserSuccess();

      expect(routerService.getAndClearLoginRedirectUrl).not.toHaveBeenCalled();
      expect(organizationInviteService.clearOrganizationInvite).not.toHaveBeenCalled();
    });
  });
});
