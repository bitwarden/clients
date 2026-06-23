import { TestBed } from "@angular/core/testing";
import { MockProxy, mock } from "jest-mock-extended";

// eslint-disable-next-line no-restricted-imports
import { CollectionService } from "@bitwarden/admin-console/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { CollectionId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";

import { BulkDeleteService } from "./bulk-delete.service";

describe("BulkDeleteService", () => {
  const userId = "user-id" as UserId;

  let cipherService: MockProxy<CipherService>;
  let apiService: MockProxy<ApiService>;
  let collectionService: MockProxy<CollectionService>;
  let syncService: MockProxy<SyncService>;
  let service: BulkDeleteService;

  beforeEach(() => {
    cipherService = mock<CipherService>();
    apiService = mock<ApiService>();
    collectionService = mock<CollectionService>();
    syncService = mock<SyncService>();

    TestBed.configureTestingModule({
      providers: [
        BulkDeleteService,
        { provide: CipherService, useValue: cipherService },
        { provide: ApiService, useValue: apiService },
        { provide: CollectionService, useValue: collectionService },
        { provide: SyncService, useValue: syncService },
        { provide: AccountService, useValue: mockAccountServiceWith(userId) },
      ],
    });

    service = TestBed.inject(BulkDeleteService);
  });

  describe("deleteCiphers", () => {
    it("soft deletes personal ciphers via the non-admin path", async () => {
      await service.deleteCiphers({
        cipherIds: ["c1", "c2"],
        unassignedCiphers: [],
        permanent: false,
      });

      expect(cipherService.softDeleteManyWithServer).toHaveBeenCalledWith(
        ["c1", "c2"],
        userId,
        undefined,
        undefined,
      );
      expect(cipherService.deleteManyWithServer).not.toHaveBeenCalled();
    });

    it("permanently deletes when permanent is true", async () => {
      await service.deleteCiphers({ cipherIds: ["c1"], unassignedCiphers: [], permanent: true });

      expect(cipherService.deleteManyWithServer).toHaveBeenCalledWith(
        ["c1"],
        userId,
        undefined,
        undefined,
      );
      expect(cipherService.softDeleteManyWithServer).not.toHaveBeenCalled();
    });

    it("routes through the admin endpoint when the organization can edit all ciphers", async () => {
      const organization = {
        id: "org-id" as OrganizationId,
        canEditAllCiphers: true,
      } as unknown as Organization;

      await service.deleteCiphers({
        cipherIds: ["c1"],
        unassignedCiphers: [],
        permanent: false,
        organization,
      });

      expect(cipherService.softDeleteManyWithServer).toHaveBeenCalledWith(
        ["c1"],
        userId,
        true,
        "org-id",
      );
    });

    it("deletes unassigned ciphers through the admin endpoint when permitted", async () => {
      const organization = {
        id: "org-id" as OrganizationId,
        canEditUnassignedCiphers: true,
      } as unknown as Organization;

      await service.deleteCiphers({
        cipherIds: [],
        unassignedCiphers: ["u1"],
        permanent: false,
        organization,
      });

      expect(cipherService.softDeleteManyWithServer).toHaveBeenCalledWith(
        ["u1"],
        userId,
        true,
        "org-id",
      );
    });
  });

  describe("deleteCollections", () => {
    it("deletes collections per organization, full syncs, then clears local state", async () => {
      const collections = [
        new CollectionView({
          id: "col1" as CollectionId,
          organizationId: "org-a" as OrganizationId,
          name: "Collection 1",
        }),
        new CollectionView({
          id: "col2" as CollectionId,
          organizationId: "org-a" as OrganizationId,
          name: "Collection 2",
        }),
        new CollectionView({
          id: "col3" as CollectionId,
          organizationId: "org-b" as OrganizationId,
          name: "Collection 3",
        }),
      ];

      await service.deleteCollections(collections);

      expect(apiService.deleteManyCollections).toHaveBeenCalledWith("org-a", ["col1", "col2"]);
      expect(apiService.deleteManyCollections).toHaveBeenCalledWith("org-b", ["col3"]);
      expect(syncService.fullSync).toHaveBeenCalledWith(true);
      expect(collectionService.delete).toHaveBeenCalledWith(["col1", "col2", "col3"], userId);
    });
  });
});
