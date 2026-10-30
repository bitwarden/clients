// @ts-strict-ignore
import { mock } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderApiServiceAbstraction } from "@bitwarden/common/vault/abstractions/folder/folder-api.service.abstraction";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherAuthorizationService } from "@bitwarden/common/vault/services/cipher-authorization.service";

import { DeleteCommand } from "./delete.command";
import { CliRestrictedItemTypesService } from "./services/cli-restricted-item-types.service";

describe("DeleteCommand", () => {
  const apiService = mock<ApiService>();

  const validOrgId = "11111111-1111-1111-1111-111111111111";
  const validCollectionId = "22222222-2222-2222-2222-222222222222";

  let command: DeleteCommand;

  beforeEach(() => {
    jest.clearAllMocks();
    command = new DeleteCommand(
      mock<CipherService>(),
      mock<FolderService>(),
      apiService,
      mock<FolderApiServiceAbstraction>(),
      mock<BillingAccountProfileStateService>(),
      mock<CipherAuthorizationService>(),
      mock<AccountService>(),
      mock<CliRestrictedItemTypesService>(),
    );
  });

  describe.each(["org-collection", "org-shared-folder"])("%s", (object) => {
    it("deletes the collection", async () => {
      const result = await command.run(object, validCollectionId, { organizationid: validOrgId });

      expect(result.success).toBe(true);
      expect(apiService.deleteCollection).toHaveBeenCalledWith(validOrgId, validCollectionId);
    });

    it("requires the organizationid option", async () => {
      const result = await command.run(object, validCollectionId, {});

      expect(result.success).toBe(false);
      expect(apiService.deleteCollection).not.toHaveBeenCalled();
    });
  });
});
