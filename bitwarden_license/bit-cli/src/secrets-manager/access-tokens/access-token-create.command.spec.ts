import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { ServiceAccountView } from "@bitwarden/bit-common/secrets-manager/models/view/service-account.view";
import { AccessService } from "@bitwarden/bit-common/secrets-manager/service-accounts/access/access.service";
import { ServiceAccountService } from "@bitwarden/bit-common/secrets-manager/service-accounts/service-account.service";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { OrgKey } from "@bitwarden/common/types/key";
import { KeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import {
  CsprngArray,
  EncryptService,
  EncString,
  KeyGenerationService,
  SymmetricCryptoKey,
} from "@bitwarden/legacy-crypto";

import { mockSmOrganization, smNotFoundError, smOrgId, smOtherOrgId } from "../spec/sm-test-utils";

import { AccessTokenCreateCommand } from "./access-token-create.command";

describe("AccessTokenCreateCommand", () => {
  const keyService = mock<KeyService>();
  const apiService = mock<ApiService>();
  const keyGenerationService = mock<KeyGenerationService>();
  const encryptService = mock<EncryptService>();
  const logService = mock<LogService>();
  const serviceAccountService = mock<ServiceAccountService>();
  const organizationService = mock<OrganizationService>();
  const accountService = mock<AccountService>();

  const machineAccountId = "22222222-2222-2222-2222-222222222222";
  const accessTokenId = "33333333-3333-3333-3333-333333333333";
  const clientSecret = "client-secret";
  const orgKey = new SymmetricCryptoKey(new Uint8Array(64).fill(1) as CsprngArray) as OrgKey;
  const derivedKey = new SymmetricCryptoKey(new Uint8Array(64).fill(2) as CsprngArray);
  const material = new Uint8Array(16).fill(3) as CsprngArray;
  const expectedToken =
    "0." + accessTokenId + "." + clientSecret + ":" + Utils.fromBufferToB64(material);

  let accessService: AccessService;
  let command: AccessTokenCreateCommand;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSmOrganization(accountService, organizationService);
    keyService.orgKeys$.mockReturnValue(
      of({ [smOrgId as OrganizationId]: orgKey } as Record<OrganizationId, OrgKey>),
    );
    keyGenerationService.createKeyWithPurpose.mockResolvedValue({
      salt: "bitwarden-accesstoken",
      material,
      derivedKey,
    });
    encryptService.encryptString.mockImplementation(
      async (plainValue: string) => new EncString("2.enc|" + plainValue),
    );
    apiService.send.mockResolvedValue({
      Id: accessTokenId,
      Name: "2.enc|CI",
      ClientSecret: clientSecret,
      ExpireAt: null,
      CreationDate: "2026-01-01T00:00:00Z",
      RevisionDate: "2026-01-01T00:00:00Z",
    });
    serviceAccountService.getByServiceAccountId.mockResolvedValue(
      Object.assign(new ServiceAccountView(), { id: machineAccountId, organizationId: smOrgId }),
    );

    accessService = new AccessService(
      keyService,
      apiService,
      keyGenerationService,
      encryptService,
      accountService,
      logService,
    );
    command = new AccessTokenCreateCommand(
      accessService,
      serviceAccountService,
      organizationService,
      accountService,
    );
  });

  it("returns the access token in the `0.<id>.<clientSecret>:<key>` format", async () => {
    const response = await command.run(smOrgId, machineAccountId, { name: "CI" });

    expect(response.success).toBe(true);
    expect(response.data).toEqual({
      object: "sm-access-token",
      id: accessTokenId,
      machineAccountId,
      name: "CI",
      expireAt: null,
      accessToken: expectedToken,
    });
  });

  it("creates the access token with the shared access token crypto", async () => {
    const expires = "2099-12-31T00:00:00Z";

    await command.run(smOrgId, machineAccountId, { name: "CI", expires });

    expect(keyGenerationService.createKeyWithPurpose).toHaveBeenCalledWith(
      128,
      "sm-access-token",
      "bitwarden-accesstoken",
    );
    expect(encryptService.encryptString).toHaveBeenCalledWith("CI", orgKey);
    expect(encryptService.encryptString).toHaveBeenCalledWith(
      JSON.stringify({ encryptionKey: orgKey.keyB64 }),
      derivedKey,
    );
    expect(encryptService.encryptString).toHaveBeenCalledWith(derivedKey.keyB64, orgKey);
    expect(apiService.send).toHaveBeenCalledWith(
      "POST",
      "/service-accounts/" + machineAccountId + "/access-tokens",
      expect.objectContaining({
        name: new EncString("2.enc|CI"),
        expireAt: new Date(expires),
      }),
      true,
      true,
    );
  });

  it("returns only the access token string when raw output is requested", async () => {
    const response = await command.run(smOrgId, machineAccountId, { name: "CI", raw: true });

    expect(response.success).toBe(true);
    expect(response.data).toEqual({ object: "string", data: expectedToken });
  });

  it("never logs the access token", async () => {
    await command.run(smOrgId, machineAccountId, { name: "CI" });

    for (const call of [
      ...logService.debug.mock.calls,
      ...logService.info.mock.calls,
      ...logService.warning.mock.calls,
      ...logService.error.mock.calls,
    ]) {
      expect(JSON.stringify(call)).not.toContain(clientSecret);
    }
  });

  it("requires a name", async () => {
    const response = await command.run(smOrgId, machineAccountId, { name: "  " });

    expect(response.success).toBe(false);
    expect(response.message).toBe("`name` is required.");
    expect(apiService.send).not.toHaveBeenCalled();
  });

  it("rejects a name longer than 80 characters", async () => {
    const response = await command.run(smOrgId, machineAccountId, { name: "a".repeat(81) });

    expect(response.success).toBe(false);
    expect(response.message).toBe("`name` must be at most 80 characters.");
  });

  it.each([undefined, "", "never", "none", "NEVER", "None"])(
    "creates an access token that does not expire for the expiration `%s`",
    async (expires) => {
      const response = await command.run(smOrgId, machineAccountId, { name: "CI", expires });

      expect(response.success).toBe(true);
      expect(response.data).toMatchObject({ expireAt: null });
      expect(apiService.send).toHaveBeenCalledWith(
        "POST",
        "/service-accounts/" + machineAccountId + "/access-tokens",
        expect.objectContaining({ expireAt: null }),
        true,
        true,
      );
    },
  );

  it("creates an access token that expires at an ISO 8601 date", async () => {
    const response = await command.run(smOrgId, machineAccountId, {
      name: "CI",
      expires: "2099-12-31",
    });

    expect(response.success).toBe(true);
    expect(response.data).toMatchObject({ expireAt: new Date("2099-12-31") });
  });

  it.each(["tomorrow", "12/31/2099", "forever"])(
    "rejects the expiration `%s` and names the accepted forms",
    async (expires) => {
      const response = await command.run(smOrgId, machineAccountId, { name: "CI", expires });

      expect(response.success).toBe(false);
      expect(response.message).toBe(
        "`expires` must be `never`, `none`, or an ISO 8601 date, e.g. 2026-12-31 or 2026-12-31T23:59:59Z.",
      );
      expect(apiService.send).not.toHaveBeenCalled();
    },
  );

  it("rejects an expiration that is not a real date", async () => {
    const response = await command.run(smOrgId, machineAccountId, {
      name: "CI",
      expires: "2099-13-45",
    });

    expect(response.success).toBe(false);
    expect(response.message).toBe("`expires` is not a valid date.");
    expect(apiService.send).not.toHaveBeenCalled();
  });

  it("rejects an expiration in the past", async () => {
    const response = await command.run(smOrgId, machineAccountId, {
      name: "CI",
      expires: "2000-01-01",
    });

    expect(response.success).toBe(false);
    expect(response.message).toBe("`expires` must be in the future.");
  });

  it("rejects a machine account in another organization", async () => {
    serviceAccountService.getByServiceAccountId.mockResolvedValue(
      Object.assign(new ServiceAccountView(), {
        id: machineAccountId,
        organizationId: smOtherOrgId,
      }),
    );

    const response = await command.run(smOrgId, machineAccountId, { name: "CI" });

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "The machine account was not found, or you do not have access to it.",
    );
    expect(keyGenerationService.createKeyWithPurpose).not.toHaveBeenCalled();
  });

  it("reports a machine account the user cannot access", async () => {
    serviceAccountService.getByServiceAccountId.mockRejectedValue(smNotFoundError());

    const response = await command.run(smOrgId, machineAccountId, { name: "CI" });

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "The machine account was not found, or you do not have access to it.",
    );
  });

  it("rejects an organization without Secrets Manager access", async () => {
    mockSmOrganization(accountService, organizationService, false);

    const response = await command.run(smOrgId, machineAccountId, { name: "CI" });

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      "You do not have access to Secrets Manager for this organization.",
    );
  });
});
