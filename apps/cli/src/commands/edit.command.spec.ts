// @ts-strict-ignore
import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { mockAccountInfoWith } from "@bitwarden/common/spec";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderApiServiceAbstraction } from "@bitwarden/common/vault/abstractions/folder/folder-api.service.abstraction";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CipherAuthorizationService } from "@bitwarden/common/vault/services/cipher-authorization.service";
import { KeyService } from "@bitwarden/key-management";
import { UserId } from "@bitwarden/user-core";

import { OrganizationCollectionRequest } from "../admin-console/models/request/organization-collection.request";
import { CliRestrictedItemTypesService } from "../vault/services/cli-restricted-item-types.service";

import { EditCommand } from "./edit.command";

describe("EditCommand", () => {
  const cipherService = mock<CipherService>();
  const folderService = mock<FolderService>();
  const keyService = mock<KeyService>();
  const encryptService = mock<EncryptService>();
  const apiService = mock<ApiService>();
  const folderApiService = mock<FolderApiServiceAbstraction>();
  const accountService = mock<AccountService>();
  const cliRestrictedItemTypesService = mock<CliRestrictedItemTypesService>();
  const policyService = mock<PolicyService>();
  const billingAccountProfileStateService = mock<BillingAccountProfileStateService>();
  const cipherAuthorizationService = mock<CipherAuthorizationService>();

  const userId = "user-id" as UserId;
  const validOrgId = "11111111-1111-1111-1111-111111111111" as OrganizationId;
  const validCollectionId = "22222222-2222-2222-2222-222222222222";
  const mockOrgKey = { key: "mock-org-key" } as any;
  const mockEncString = { encryptedString: "encrypted-name" } as any;

  const activeAccount = {
    id: userId,
    ...mockAccountInfoWith({ email: "user@example.com", name: "Test User" }),
  };

  let command: EditCommand;

  const makeRequest = (overrides: Partial<OrganizationCollectionRequest> = {}) => {
    const req = new OrganizationCollectionRequest();
    req.organizationId = validOrgId;
    req.name = "My Collection";
    req.externalId = null;
    req.groups = null;
    req.users = null;
    return Object.assign(req, overrides);
  };

  const makeOptions = (overrides: Record<string, unknown> = {}) => ({
    organizationId: validOrgId,
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();

    accountService.activeAccount$ = of(activeAccount as any);
    keyService.orgKeys$.mockReturnValue(of({ [validOrgId]: mockOrgKey }));
    encryptService.encryptString.mockResolvedValue(mockEncString);
    apiService.putCollection.mockResolvedValue({ id: validCollectionId } as any);
    billingAccountProfileStateService.hasPremiumFromAnySource$.mockReturnValue(of(true));

    command = new EditCommand(
      cipherService,
      folderService,
      keyService,
      encryptService,
      apiService,
      folderApiService,
      accountService,
      cliRestrictedItemTypesService,
      policyService,
      billingAccountProfileStateService,
      cipherAuthorizationService,
    );
  });

  describe("editCipher", () => {
    const cipherId = "cipher-id";
    const encodedReq = Buffer.from(JSON.stringify({ name: "Updated" })).toString("base64");

    it("returns notFound when cipher does not exist", async () => {
      cipherService.get.mockResolvedValue(null);

      const result = await command.run("item", cipherId, encodedReq, {});

      expect(result.success).toBe(false);
      expect(result.message).toContain("Not found");
      expect(cipherAuthorizationService.canEditCipher$).not.toHaveBeenCalled();
    });

    it("returns noEditPermission when user cannot edit the cipher", async () => {
      const cipher = { id: cipherId, edit: false } as Cipher;
      cipherService.get.mockResolvedValue(cipher);
      cipherAuthorizationService.canEditCipher$.mockReturnValue(of(false));

      const result = await command.run("item", cipherId, encodedReq, {});

      expect(result.success).toBe(false);
      expect(result.message).toContain("You do not have permission to edit this item");
      expect(cipherService.updateWithServer).not.toHaveBeenCalled();
    });

    it("proceeds to update when user has edit permission", async () => {
      const cipher = { id: cipherId, edit: true } as Cipher;
      const cipherView = { id: cipherId, isDeleted: false } as CipherView;
      cipherService.get.mockResolvedValue(cipher);
      cipherService.decrypt.mockResolvedValue(cipherView);
      cipherAuthorizationService.canEditCipher$.mockReturnValue(of(true));
      cliRestrictedItemTypesService.isCipherRestricted.mockResolvedValue(false);
      policyService.policyAppliesToUser$.mockReturnValue(of(false));
      billingAccountProfileStateService.hasPremiumFromAnySource$.mockReturnValue(of(true));
      cipherService.updateWithServer.mockResolvedValue(cipherView);

      const result = await command.run("item", cipherId, encodedReq, {});

      expect(cipherAuthorizationService.canEditCipher$).toHaveBeenCalledWith(cipher);
      expect(cipherService.updateWithServer).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });

  describe("editOrganizationCollection", () => {
    it("returns bad request when organizationId option is missing", async () => {
      const result = await command["editOrganizationCollection"](validCollectionId, makeRequest(), {
        organizationId: null,
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain("`organizationid` option is required");
    });

    it("returns bad request when organizationId option is empty string", async () => {
      const result = await command["editOrganizationCollection"](validCollectionId, makeRequest(), {
        organizationId: "",
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain("`organizationid` option is required");
    });

    it("returns bad request when collection id is not a valid GUID", async () => {
      const result = await command["editOrganizationCollection"](
        "not-a-guid",
        makeRequest(),
        makeOptions(),
      );
      expect(result.success).toBe(false);
      expect(result.message).toContain("is not a GUID");
    });

    it("returns bad request when organizationId option is not a valid GUID", async () => {
      const result = await command["editOrganizationCollection"](validCollectionId, makeRequest(), {
        organizationId: "not-a-guid",
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain("is not a GUID");
    });

    it("returns bad request when organizationId option does not match request", async () => {
      const otherOrgId = "33333333-3333-3333-3333-333333333333" as OrganizationId;
      const result = await command["editOrganizationCollection"](
        validCollectionId,
        makeRequest({ organizationId: otherOrgId }),
        makeOptions(),
      );
      expect(result.success).toBe(false);
      expect(result.message).toContain("`organizationid` option does not match request object");
    });

    it("returns bad request when collection name is empty string", async () => {
      const result = await command["editOrganizationCollection"](
        validCollectionId,
        makeRequest({ name: "" }),
        makeOptions(),
      );
      expect(result.success).toBe(false);
      expect(result.message).toContain("Collection name is required");
    });

    it("returns bad request when collection name is whitespace only", async () => {
      const result = await command["editOrganizationCollection"](
        validCollectionId,
        makeRequest({ name: "   " }),
        makeOptions(),
      );
      expect(result.success).toBe(false);
      expect(result.message).toContain("Collection name is required");
    });

    it("returns bad request when collection name is null", async () => {
      const result = await command["editOrganizationCollection"](
        validCollectionId,
        makeRequest({ name: null }),
        makeOptions(),
      );
      expect(result.success).toBe(false);
      expect(result.message).toContain("Collection name is required");
    });

    it("returns error when no org encryption key is found", async () => {
      keyService.orgKeys$.mockReturnValue(of({} as any));
      const result = await command["editOrganizationCollection"](
        validCollectionId,
        makeRequest(),
        makeOptions(),
      );
      expect(result.success).toBe(false);
      expect(result.message).toContain("No encryption key for this organization");
    });

    it("updates collection successfully with groups and users provided", async () => {
      const groups = [{ id: "group-1", readOnly: false, hidePasswords: false, manage: true }];
      const users = [{ id: "user-1", readOnly: false, hidePasswords: false, manage: false }];
      const result = await command["editOrganizationCollection"](
        validCollectionId,
        makeRequest({ groups, users }),
        makeOptions(),
      );
      expect(result.success).toBe(true);
      expect(encryptService.encryptString).toHaveBeenCalledWith("My Collection", mockOrgKey);
      expect(apiService.putCollection).toHaveBeenCalledWith(
        validOrgId,
        validCollectionId,
        expect.objectContaining({ name: mockEncString.encryptedString }),
      );
    });

    it("handles null groups and users", async () => {
      const result = await command["editOrganizationCollection"](
        validCollectionId,
        makeRequest({ groups: null, users: null }),
        makeOptions(),
      );
      expect(result.success).toBe(true);
      expect(apiService.putCollection).toHaveBeenCalled();
    });

    it("returns error when the API call fails", async () => {
      apiService.putCollection.mockRejectedValue(new Error("API error"));
      const result = await command["editOrganizationCollection"](
        validCollectionId,
        makeRequest(),
        makeOptions(),
      );
      expect(result.success).toBe(false);
      expect(result.message).toContain("API error");
    });
  });
});
