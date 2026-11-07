import { MockProxy, mock } from "jest-mock-extended";

import {
  DirectOrganizationInvite,
  OpenOrganizationInvite,
  OrganizationInviteService,
} from "@bitwarden/common/auth/organization-invite";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { RouterService } from "../../../../core/router.service";

import { WebLoginDecryptionOptionsService } from "./web-login-decryption-options.service";

describe("WebLoginDecryptionOptionsService", () => {
  let service: WebLoginDecryptionOptionsService;

  let routerService: MockProxy<RouterService>;
  let organizationInviteService: MockProxy<OrganizationInviteService>;
  let configService: MockProxy<ConfigService>;

  const directInvite = new DirectOrganizationInvite({
    organizationId: "org-id",
    token: "token",
    email: "test@example.com",
    organizationUserId: "org-user-id",
    initOrganization: false,
    orgSsoIdentifier: "sso-id",
    orgUserHasExistingUser: false,
    organizationName: "org-name",
  });

  const openInvite = new OpenOrganizationInvite({
    organizationId: "org-id",
    inviteLinkCode: "invite-link-code",
    inviteKey: "invite-key",
    organizationName: "org-name",
  });

  function setInviteLinkAutoConfirm(enabled: boolean) {
    configService.getFeatureFlag.mockImplementation(
      async (flag) => enabled && flag === FeatureFlag.InviteLinkAutoConfirm,
    );
  }

  beforeEach(() => {
    routerService = mock<RouterService>();
    organizationInviteService = mock<OrganizationInviteService>();
    configService = mock<ConfigService>();
    setInviteLinkAutoConfirm(false);

    service = new WebLoginDecryptionOptionsService(
      routerService,
      organizationInviteService,
      configService,
    );
  });

  it("should instantiate the service", () => {
    expect(service).not.toBeFalsy();
  });

  describe("handleCreateUserSuccess()", () => {
    it("should keep the redirect URL and the open org invite when InviteLinkAutoConfirm is on", async () => {
      setInviteLinkAutoConfirm(true);
      organizationInviteService.getOrganizationInvite.mockResolvedValue(openInvite);

      await service.handleCreateUserSuccess();

      expect(routerService.getAndClearLoginRedirectUrl).not.toHaveBeenCalled();
      expect(organizationInviteService.clearOrganizationInvite).not.toHaveBeenCalled();
    });

    it("should clear the redirect URL and the direct org invite when InviteLinkAutoConfirm is on", async () => {
      setInviteLinkAutoConfirm(true);
      organizationInviteService.getOrganizationInvite.mockResolvedValue(directInvite);

      await service.handleCreateUserSuccess();

      expect(routerService.getAndClearLoginRedirectUrl).toHaveBeenCalled();
      expect(organizationInviteService.clearOrganizationInvite).toHaveBeenCalled();
    });

    it("should clear the redirect URL and the open org invite when InviteLinkAutoConfirm is off", async () => {
      setInviteLinkAutoConfirm(false);
      organizationInviteService.getOrganizationInvite.mockResolvedValue(openInvite);

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
