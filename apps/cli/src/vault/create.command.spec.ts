// @ts-strict-ignore
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { mockAccountInfoWith } from "@bitwarden/common/spec";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderApiServiceAbstraction } from "@bitwarden/common/vault/abstractions/folder/folder-api.service.abstraction";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { KeyService } from "@bitwarden/key-management";
import { UserId } from "@bitwarden/user-core";

import { OrganizationCollectionRequest } from "../admin-console/models/request/organization-collection.request";

import { CreateCommand } from "./create.command";
import { CliRestrictedItemTypesService } from "./services/cli-restricted-item-types.service";

describe("CreateCommand", () => {
  const cipherService = mock<CipherService>();
  const folderService = mock<FolderService>();
  const keyService = mock<KeyService>();
  const encryptService = mock<EncryptService>();
  const apiService = mock<ApiService>();
  const folderApiService = mock<FolderApiServiceAbstraction>();
  const accountProfileService = mock<BillingAccountProfileStateService>();
  const organizationService = mock<OrganizationService>();
  const accountService = mock<AccountService>();
  const cliRestrictedItemTypesService = mock<CliRestrictedItemTypesService>();

  const userId = "user-id" as UserId;
  const validOrgId = "11111111-1111-1111-1111-111111111111" as OrganizationId;
  const orgUserId = "org-user-id";
  const mockOrgKey = { key: "mock-org-key" } as any;
  const mockEncString = { encryptedString: "encrypted-name" } as any;

  const activeAccount = {
    id: userId,
    ...mockAccountInfoWith({ email: "user@example.com", name: "Test User" }),
  };

  let command: CreateCommand;

  const makeRequest = (overrides: Partial<OrganizationCollectionRequest> = {}) => {
    const req = new OrganizationCollectionRequest();
    req.organizationId = validOrgId;
    req.name = "My Collection";
    req.externalId = "";
    req.groups = [];
    req.users = [];
    return Object.assign(req, overrides);
  };

  const makeOptions = (overrides: Record<string, unknown> = {}) => ({
    itemId: null as string,
    organizationId: validOrgId as string,
    file: null as string,
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();

    accountService.activeAccount$ = of(activeAccount as any);
    organizationService.organizations$.mockReturnValue(
      of([{ id: validOrgId, organizationUserId: orgUserId }] as any),
    );
    keyService.getOrgKey.mockResolvedValue(mockOrgKey);
    encryptService.encryptString.mockResolvedValue(mockEncString);
    apiService.postCollection.mockResolvedValue({ id: "new-collection-id" } as any);

    command = new CreateCommand(
      cipherService,
      folderService,
      keyService,
      encryptService,
      apiService,
      folderApiService,
      accountProfileService,
      organizationService,
      accountService,
      cliRestrictedItemTypesService,
    );
  });

  describe("createOrganizationCollection", () => {
    it("returns bad request when organizationId option is missing", async () => {
      const result = await command["createOrganizationCollection"](
        makeRequest(),
        makeOptions({ organizationId: null }),
      );
      expect(result.success).toBe(false);
      expect(result.message).toContain("`organizationid` option is required");
    });

    it("returns bad request when organizationId option is empty string", async () => {
      const result = await command["createOrganizationCollection"](
        makeRequest(),
        makeOptions({ organizationId: "" }),
      );
      expect(result.success).toBe(false);
      expect(result.message).toContain("`organizationid` option is required");
    });

    it("returns bad request when organizationId is not a valid GUID", async () => {
      const result = await command["createOrganizationCollection"](
        makeRequest(),
        makeOptions({ organizationId: "not-a-guid" }),
      );
      expect(result.success).toBe(false);
      expect(result.message).toContain("is not a GUID");
    });

    it("returns bad request when organizationId option does not match request", async () => {
      const otherOrgId = "22222222-2222-2222-2222-222222222222" as OrganizationId;
      const result = await command["createOrganizationCollection"](
        makeRequest({ organizationId: otherOrgId }),
        makeOptions(),
      );
      expect(result.success).toBe(false);
      expect(result.message).toContain("`organizationid` option does not match request object");
    });

    it("returns bad request when collection name is empty string", async () => {
      const result = await command["createOrganizationCollection"](
        makeRequest({ name: "" }),
        makeOptions(),
      );
      expect(result.success).toBe(false);
      expect(result.message).toContain("Collection name is required");
    });

    it("returns bad request when collection name is whitespace only", async () => {
      const result = await command["createOrganizationCollection"](
        makeRequest({ name: "   " }),
        makeOptions(),
      );
      expect(result.success).toBe(false);
      expect(result.message).toContain("Collection name is required");
    });

    it("returns bad request when collection name is null", async () => {
      const result = await command["createOrganizationCollection"](
        makeRequest({ name: null }),
        makeOptions(),
      );
      expect(result.success).toBe(false);
      expect(result.message).toContain("Collection name is required");
    });

    it("returns error when no org encryption key is found", async () => {
      keyService.getOrgKey.mockResolvedValue(null);
      const result = await command["createOrganizationCollection"](makeRequest(), makeOptions());
      expect(result.success).toBe(false);
      expect(result.message).toContain("No encryption key for this organization");
    });

    it("returns bad request when no active user is found", async () => {
      accountService.activeAccount$ = of(null);
      const result = await command["createOrganizationCollection"](makeRequest(), makeOptions());
      expect(result.success).toBe(false);
      expect(result.message).toContain("No user found");
    });

    it("creates collection successfully with groups and users provided", async () => {
      const groups = [{ id: "group-1", readOnly: false, hidePasswords: false, manage: true }];
      const users = [{ id: "user-1", readOnly: false, hidePasswords: false, manage: true }];
      const result = await command["createOrganizationCollection"](
        makeRequest({ groups, users }),
        makeOptions(),
      );
      expect(result.success).toBe(true);
      expect(encryptService.encryptString).toHaveBeenCalledWith("My Collection", mockOrgKey);
      expect(apiService.postCollection).toHaveBeenCalledWith(
        validOrgId,
        expect.objectContaining({ name: mockEncString.encryptedString }),
      );
    });

    it("handles null groups by passing null to the request", async () => {
      const result = await command["createOrganizationCollection"](
        makeRequest({ groups: null }),
        makeOptions(),
      );
      expect(result.success).toBe(true);
      expect(apiService.postCollection).toHaveBeenCalled();
    });

    it("defaults users to the current org user when users is null", async () => {
      const result = await command["createOrganizationCollection"](
        makeRequest({ users: null }),
        makeOptions(),
      );
      expect(result.success).toBe(true);
      expect(apiService.postCollection).toHaveBeenCalledWith(
        validOrgId,
        expect.objectContaining({
          users: [expect.objectContaining({ id: orgUserId })],
        }),
      );
    });

    it("returns error when the API call fails", async () => {
      apiService.postCollection.mockRejectedValue(new Error("API error"));
      const result = await command["createOrganizationCollection"](makeRequest(), makeOptions());
      expect(result.success).toBe(false);
      expect(result.message).toContain("API error");
    });
  });
});
