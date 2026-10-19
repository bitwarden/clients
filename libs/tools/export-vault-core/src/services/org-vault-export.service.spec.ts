import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { Collection } from "@bitwarden/common/admin-console/models/collections";
import { OrganizationExportResponse } from "@bitwarden/common/admin-console/models/response/organization-export.response";
import { OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherData } from "@bitwarden/common/vault/models/data/cipher.data";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CipherResponse } from "@bitwarden/common/vault/models/response/cipher.response";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { RestrictedItemTypesService } from "@bitwarden/common/vault/services/restricted-item-types.service";
import { KdfConfigService, KeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import {
  EncryptService,
  EncString,
  KeyGenerationService,
  SymmetricCryptoKey,
} from "@bitwarden/legacy-crypto";

import { VaultExportApiService } from "./api/vault-export-api.service.abstraction";
import { OrganizationVaultExportService } from "./org-vault-export.service";

const userId = "user-1" as UserId;
const organizationId = "org-1" as OrganizationId;
const ENC_NAME = "2.name==|name==|name==";

/** An ordinary item and a PAM-gated ("partial") one, as the server returns them. */
function cipherResponses(): CipherResponse[] {
  return [
    new CipherResponse({
      Id: "visible",
      OrganizationId: organizationId,
      Type: CipherType.Login,
      Name: ENC_NAME,
      Login: {},
      CollectionIds: ["col-1"],
      DeletedDate: null,
    }),
    new CipherResponse({
      Id: "gated",
      OrganizationId: organizationId,
      Type: CipherType.Login,
      PartialData: JSON.stringify({ Name: ENC_NAME }),
      CollectionIds: ["col-1"],
      DeletedDate: null,
    }),
  ];
}

function exportedIds(data: string): string[] {
  return JSON.parse(data).items.map((item: { id: string }) => item.id);
}

describe("OrganizationVaultExportService", () => {
  let cipherService: MockProxy<CipherService>;
  let vaultExportApiService: MockProxy<VaultExportApiService>;
  let collectionService: MockProxy<CollectionService>;
  let service: OrganizationVaultExportService;

  beforeEach(() => {
    cipherService = mock<CipherService>();
    cipherService.decrypt.mockImplementation(async (cipher: Cipher) =>
      Object.assign(new CipherView(), {
        id: cipher.id,
        organizationId: cipher.organizationId,
        type: cipher.type,
        name: "Item",
        partial: cipher.isPartial,
      }),
    );

    vaultExportApiService = mock<VaultExportApiService>();
    vaultExportApiService.getOrganizationExport.mockResolvedValue(
      Object.assign(new OrganizationExportResponse({}), { ciphers: cipherResponses() }),
    );

    collectionService = mock<CollectionService>();
    collectionService.encryptedCollections$.mockReturnValue(
      of([{ id: "col-1", organizationId, manage: true } as unknown as Collection]),
    );

    const keyService = mock<KeyService>();
    keyService.orgKeys$.mockReturnValue(
      of({ [organizationId]: new SymmetricCryptoKey(new Uint8Array(64)) } as never),
    );

    const encryptService = mock<EncryptService>();
    encryptService.encryptString.mockResolvedValue(new EncString(ENC_NAME));

    const restrictedItemTypesService = mock<RestrictedItemTypesService>();
    Object.defineProperty(restrictedItemTypesService, "restricted$", { value: of([]) });
    restrictedItemTypesService.isCipherRestricted.mockReturnValue(false);

    service = new OrganizationVaultExportService(
      cipherService,
      vaultExportApiService,
      mock<KeyGenerationService>(),
      keyService,
      encryptService,
      collectionService,
      mock<KdfConfigService>(),
      restrictedItemTypesService,
    );
  });

  describe("gated (partial) ciphers, which have no sensitive fields to export", () => {
    it("are left out of an encrypted export from the export API", async () => {
      const result = await service.getOrganizationExport(
        userId,
        organizationId,
        "encrypted_json",
        false,
      );

      expect(exportedIds(result.data as string)).toEqual(["visible"]);
    });

    it("are left out of an unencrypted export from the export API", async () => {
      const result = await service.getOrganizationExport(userId, organizationId, "json", false);

      expect(exportedIds(result.data as string)).toEqual(["visible"]);
    });

    it("are left out of an encrypted export of managed collections", async () => {
      cipherService.getAll.mockResolvedValue(
        cipherResponses().map((response) => new Cipher(new CipherData(response))),
      );

      const result = await service.getOrganizationExport(
        userId,
        organizationId,
        "encrypted_json",
        true,
      );

      expect(exportedIds(result.data as string)).toEqual(["visible"]);
    });
  });
});
