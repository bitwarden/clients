import { mock } from "jest-mock-extended";

import {
  AccessService,
  AccessTokenView,
  ServiceAccountService,
  ServiceAccountView,
} from "@bitwarden/bit-sm";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";

import { mockSmOrganization, smNotFoundError, smOrgId } from "../spec/sm-test-utils";

import { AccessTokenListCommand } from "./access-token-list.command";

describe("AccessTokenListCommand", () => {
  const accessService = mock<AccessService>();
  const serviceAccountService = mock<ServiceAccountService>();
  const organizationService = mock<OrganizationService>();
  const accountService = mock<AccountService>();
  const machineAccountId = "22222222-2222-2222-2222-222222222222";
  const tokenId = "33333333-3333-3333-3333-333333333333";
  let command: AccessTokenListCommand;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSmOrganization(accountService, organizationService);
    serviceAccountService.getByServiceAccountId.mockResolvedValue(
      Object.assign(new ServiceAccountView(), { id: machineAccountId, organizationId: smOrgId }),
    );
    command = new AccessTokenListCommand(
      accessService,
      serviceAccountService,
      organizationService,
      accountService,
    );
  });

  it("lists the machine account's access tokens", async () => {
    const creationDate = new Date("2026-01-01T00:00:00Z");
    accessService.getAccessTokens.mockResolvedValue([
      Object.assign(new AccessTokenView(), {
        id: tokenId,
        name: "CI",
        scopes: ["api.secrets"],
        creationDate,
        revisionDate: creationDate,
      }),
    ]);

    const response = await command.run(smOrgId, machineAccountId);

    expect(response.success).toBe(true);
    expect(accessService.getAccessTokens).toHaveBeenCalledWith(smOrgId, machineAccountId);
    expect(response.data).toMatchObject({
      data: [
        {
          object: "sm-access-token",
          id: tokenId,
          machineAccountId,
          name: "CI",
          scopes: ["api.secrets"],
          expireAt: null,
        },
      ],
    });
  });

  it("reports a machine account the user cannot access", async () => {
    serviceAccountService.getByServiceAccountId.mockRejectedValue(smNotFoundError());

    const response = await command.run(smOrgId, machineAccountId);

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "The machine account was not found, or you do not have access to it.",
    );
    expect(accessService.getAccessTokens).not.toHaveBeenCalled();
  });
});
