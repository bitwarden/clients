import { MockProxy, mock } from "jest-mock-extended";

import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";

import { RouterService } from "../../../../core/router.service";
import { AcceptOrganizationInviteService } from "../../../organization-invite/accept-organization.service";

import { WebLoginDecryptionOptionsService } from "./web-login-decryption-options.service";

describe("WebLoginDecryptionOptionsService", () => {
  let service: WebLoginDecryptionOptionsService;

  let messagingService: MockProxy<MessagingService>;
  let routerService: MockProxy<RouterService>;
  let acceptOrganizationInviteService: MockProxy<AcceptOrganizationInviteService>;

  beforeEach(() => {
    messagingService = mock<MessagingService>();
    routerService = mock<RouterService>();
    acceptOrganizationInviteService = mock<AcceptOrganizationInviteService>();

    service = new WebLoginDecryptionOptionsService(
      messagingService,
      routerService,
      acceptOrganizationInviteService,
    );
  });

  it("should instantiate the service", () => {
    expect(service).not.toBeFalsy();
  });

  describe("handleCreateUserSuccess()", () => {
    it("should clear the redirect URL and the org invite", async () => {
      await service.handleCreateUserSuccess();

      expect(routerService.getAndClearLoginRedirectUrl).toHaveBeenCalled();
      expect(acceptOrganizationInviteService.clearOrganizationInvitation).toHaveBeenCalled();
    });
  });
});
