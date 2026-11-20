import { MockProxy, mock } from "jest-mock-extended";

import {
  DirectOrganizationInvite,
  OpenOrganizationInvite,
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

      await service.handleCreateUserSuccess(true);

      expect(routerService.getAndClearLoginRedirectUrl).toHaveBeenCalled();
      expect(organizationInviteService.clearOrganizationInvite).toHaveBeenCalled();
    });

    it("should NOT clear the redirect URL or the org invite when no org invite is stashed", async () => {
      organizationInviteService.getOrganizationInvite.mockResolvedValue(null);

      await service.handleCreateUserSuccess(true);

      expect(routerService.getAndClearLoginRedirectUrl).not.toHaveBeenCalled();
      expect(organizationInviteService.clearOrganizationInvite).not.toHaveBeenCalled();
    });

    it("should keep the open org invite and its login redirect URL when we send acceptOrganizationInvite: false", async () => {
      // Arrange
      organizationInviteService.getOrganizationInvite.mockResolvedValue(
        new OpenOrganizationInvite({
          organizationId: "org-id",
          inviteLinkCode: "invite-link-code",
          inviteKey: "invite-key",
          organizationName: "org-name",
        }),
      );

      // Act
      await service.handleCreateUserSuccess(false);

      // Assert
      expect(routerService.getAndClearLoginRedirectUrl).not.toHaveBeenCalled();
      expect(organizationInviteService.clearOrganizationInvite).not.toHaveBeenCalled();
    });

    it("should clear a stashed open invite for a different organization when we send acceptOrganizationInvite: true", async () => {
      // Arrange: the domain service accepts, because the open invite is for another organization.
      organizationInviteService.getOrganizationInvite.mockResolvedValue(
        new OpenOrganizationInvite({
          organizationId: "other-org-id",
          inviteLinkCode: "invite-link-code",
          inviteKey: "invite-key",
          organizationName: "other-org-name",
        }),
      );

      // Act
      await service.handleCreateUserSuccess(true);

      // Assert
      expect(routerService.getAndClearLoginRedirectUrl).toHaveBeenCalledTimes(1);
      expect(organizationInviteService.clearOrganizationInvite).toHaveBeenCalledTimes(1);
    });
  });
});
