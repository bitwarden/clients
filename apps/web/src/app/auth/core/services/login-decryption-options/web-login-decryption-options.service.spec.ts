import { MockProxy, mock } from "jest-mock-extended";

import { OrganizationInviteService } from "@bitwarden/common/auth/organization-invite";

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
    it("should clear the redirect URL and the org invite", async () => {
      await service.handleCreateUserSuccess();

      expect(routerService.getAndClearLoginRedirectUrl).toHaveBeenCalled();
      expect(organizationInviteService.clearOrganizationInvite).toHaveBeenCalled();
    });
  });
});
