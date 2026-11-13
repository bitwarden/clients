import { mock } from "jest-mock-extended";

import {
  AccessService,
  AccessTokenView,
  ServiceAccountService,
  ServiceAccountView,
} from "@bitwarden/bit-sm";

import { smOrgId, smOrg } from "../spec/sm-test-utils";

import { AccessTokenRevokeCommand } from "./access-token-revoke.command";

describe("AccessTokenRevokeCommand", () => {
  const accessService = mock<AccessService>();
  const serviceAccountService = mock<ServiceAccountService>();
  const machineAccountId = "22222222-2222-2222-2222-222222222222";
  const tokenId1 = "33333333-3333-3333-3333-333333333333";
  const tokenId2 = "44444444-4444-4444-4444-444444444444";
  let command: AccessTokenRevokeCommand;

  beforeEach(() => {
    jest.clearAllMocks();
    serviceAccountService.getByServiceAccountId.mockResolvedValue(
      Object.assign(new ServiceAccountView(), { id: machineAccountId, organizationId: smOrgId }),
    );
    accessService.getAccessTokens.mockResolvedValue([
      Object.assign(new AccessTokenView(), { id: tokenId1, name: "CI" }),
      Object.assign(new AccessTokenView(), { id: tokenId2, name: "Deploy" }),
    ]);
    command = new AccessTokenRevokeCommand(accessService, serviceAccountService);
  });

  it("revokes one or more access tokens", async () => {
    const response = await command.run(smOrg, machineAccountId, [tokenId1, tokenId2.toUpperCase()]);

    expect(response.success).toBe(true);
    expect(accessService.revokeAccessTokens).toHaveBeenCalledWith(machineAccountId, [
      tokenId1,
      tokenId2,
    ]);
  });

  it("rejects an access token that does not belong to the machine account", async () => {
    const unknownId = "55555555-5555-5555-5555-555555555555";

    const response = await command.run(smOrg, machineAccountId, [tokenId1, unknownId]);

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "The access token `" + unknownId + "` was not found, or you do not have access to it.",
    );
    expect(accessService.revokeAccessTokens).not.toHaveBeenCalled();
  });

  it("requires at least one access token id", async () => {
    const response = await command.run(smOrg, machineAccountId, []);

    expect(response.success).toBe(false);
    expect(response.message).toBe("At least one `accessTokenId` is required.");
    expect(accessService.revokeAccessTokens).not.toHaveBeenCalled();
  });

  it("rejects an invalid machine account id", async () => {
    const response = await command.run(smOrg, "nope", [tokenId1]);

    expect(response.success).toBe(false);
    expect(response.message).toBe("`nope` is not a GUID.");
    expect(serviceAccountService.getByServiceAccountId).not.toHaveBeenCalled();
  });
});
