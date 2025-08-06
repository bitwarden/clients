import { mock } from "jest-mock-extended";
import { Observable, firstValueFrom, of } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { CollectionService, CollectionView } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { UserId } from "@bitwarden/common/types/guid";

import { FakeAccountService, mockAccountServiceWith } from "../../../spec";
import { CipherPermissionsApi } from "../models/api/cipher-permissions.api";
import { CipherView } from "../models/view/cipher.view";

import {
  CipherAuthorizationService,
  DefaultCipherAuthorizationService,
} from "./cipher-authorization.service";

describe("CipherAuthorizationService", () => {
  let cipherAuthorizationService: CipherAuthorizationService;

  const mockCollectionService = mock<CollectionService>();
  const mockOrganizationService = mock<OrganizationService>();
  const mockUserId = Utils.newGuid() as UserId;
  let mockAccountService: FakeAccountService;

  // Mock factories
  const createMockCipher = (
    organizationId: string | null,
    collectionIds: string[],
    edit: boolean = true,
    permissions: CipherPermissionsApi = new CipherPermissionsApi(),
  ) => ({
    organizationId,
    collectionIds,
    edit,
    permissions,
  });

  const createMockCollection = (id: string, manage: boolean) => ({
    id,
    manage,
  });

  const createMockOrganization = ({
    allowAdminAccessToAllCollectionItems = false,
    canEditAllCiphers = false,
    canEditUnassignedCiphers = false,
    isAdmin = false,
    editAnyCollection = false,
  } = {}) => ({
    id: "org1",
    allowAdminAccessToAllCollectionItems,
    canEditAllCiphers,
    canEditUnassignedCiphers,
    isAdmin,
    permissions: {
      editAnyCollection,
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockAccountService = mockAccountServiceWith(mockUserId);
    cipherAuthorizationService = new DefaultCipherAuthorizationService(
      mockCollectionService,
      mockOrganizationService,
      mockAccountService,
    );
  });

  describe("canRestoreCipher$", () => {
    it("should return true if isAdminConsoleAction and cipher is unassigned", (done) => {
      const cipher = createMockCipher("org1", []) as CipherView;
      const organization = createMockOrganization({ canEditUnassignedCiphers: true });
      mockOrganizationService.organizations$.mockReturnValue(
        of([organization]) as Observable<Organization[]>,
      );

      cipherAuthorizationService.canRestoreCipher$(cipher, true).subscribe((result) => {
        expect(result).toBe(true);
        done();
      });
    });

    it("should return true if isAdminConsoleAction and user can edit all ciphers in the org", (done) => {
      const cipher = createMockCipher("org1", ["col1"]) as CipherView;
      const organization = createMockOrganization({ canEditAllCiphers: true });
      mockOrganizationService.organizations$.mockReturnValue(
        of([organization]) as Observable<Organization[]>,
      );

      cipherAuthorizationService.canRestoreCipher$(cipher, true).subscribe((result) => {
        expect(result).toBe(true);
        expect(mockOrganizationService.organizations$).toHaveBeenCalledWith(mockUserId);
        done();
      });
    });

    it("should return false if isAdminConsoleAction is true but user does not have permission to edit unassigned ciphers", (done) => {
      const cipher = createMockCipher("org1", []) as CipherView;
      const organization = createMockOrganization({ canEditUnassignedCiphers: false });
      mockOrganizationService.organizations$.mockReturnValue(of([organization] as Organization[]));

      cipherAuthorizationService.canRestoreCipher$(cipher, true).subscribe((result) => {
        expect(result).toBe(false);
        done();
      });
    });

    it("should return false if cipher.permission.restore is false and is not an admin action", (done) => {
      const cipher = createMockCipher("org1", [], true, {
        restore: false,
      } as CipherPermissionsApi) as CipherView;
      const organization = createMockOrganization();
      mockOrganizationService.organizations$.mockReturnValue(of([organization] as Organization[]));

      cipherAuthorizationService.canRestoreCipher$(cipher, false).subscribe((result) => {
        expect(result).toBe(false);
        expect(mockCollectionService.decryptedCollections$).not.toHaveBeenCalled();
        done();
      });
    });

    it("should return true if cipher.permission.restore is true and is not an admin action", (done) => {
      const cipher = createMockCipher("org1", [], true, {
        restore: true,
      } as CipherPermissionsApi) as CipherView;
      const organization = createMockOrganization();
      mockOrganizationService.organizations$.mockReturnValue(of([organization] as Organization[]));

      cipherAuthorizationService.canRestoreCipher$(cipher, false).subscribe((result) => {
        expect(result).toBe(true);
        expect(mockCollectionService.decryptedCollections$).not.toHaveBeenCalled();
        done();
      });
    });
  });

  describe("canDeleteCipher$", () => {
    it("should return true if isAdminConsoleAction is true and cipher is unassigned", (done) => {
      const cipher = createMockCipher("org1", []) as CipherView;
      const organization = createMockOrganization({ canEditUnassignedCiphers: true });
      mockOrganizationService.organizations$.mockReturnValue(
        of([organization]) as Observable<Organization[]>,
      );

      cipherAuthorizationService.canDeleteCipher$(cipher, true).subscribe((result) => {
        expect(result).toBe(true);
        done();
      });
    });

    it("should return true if isAdminConsoleAction is true and user can edit all ciphers in the org", (done) => {
      const cipher = createMockCipher("org1", ["col1"]) as CipherView;
      const organization = createMockOrganization({ canEditAllCiphers: true });
      mockOrganizationService.organizations$.mockReturnValue(
        of([organization]) as Observable<Organization[]>,
      );

      cipherAuthorizationService.canDeleteCipher$(cipher, true).subscribe((result) => {
        expect(result).toBe(true);
        expect(mockOrganizationService.organizations$).toHaveBeenCalledWith(mockUserId);
        done();
      });
    });

    it("should return false if isAdminConsoleAction is true but user does not have permission to edit unassigned ciphers", (done) => {
      const cipher = createMockCipher("org1", []) as CipherView;
      const organization = createMockOrganization({ canEditUnassignedCiphers: false });
      mockOrganizationService.organizations$.mockReturnValue(of([organization] as Organization[]));

      cipherAuthorizationService.canDeleteCipher$(cipher, true).subscribe((result) => {
        expect(result).toBe(false);
        done();
      });
    });

    it("should return true when cipher.permissions.delete is true", (done) => {
      const cipher = createMockCipher("org1", [], true, {
        delete: true,
      } as CipherPermissionsApi) as CipherView;
      const organization = createMockOrganization();
      mockOrganizationService.organizations$.mockReturnValue(of([organization] as Organization[]));

      cipherAuthorizationService.canDeleteCipher$(cipher, false).subscribe((result) => {
        expect(result).toBe(true);
        done();
      });
    });

    it("should return false when cipher.permissions.delete is false", (done) => {
      const cipher = createMockCipher("org1", []) as CipherView;
      const organization = createMockOrganization();
      mockOrganizationService.organizations$.mockReturnValue(of([organization] as Organization[]));

      cipherAuthorizationService.canDeleteCipher$(cipher, false).subscribe((result) => {
        expect(result).toBe(false);
        expect(mockCollectionService.decryptedCollections$).not.toHaveBeenCalled();
        done();
      });
    });
  });

  describe("canCloneCipher$", () => {
    it("should return true if cipher has no organizationId", async () => {
      const cipher = createMockCipher(null, []) as CipherView;

      const result = await firstValueFrom(cipherAuthorizationService.canCloneCipher$(cipher));
      expect(result).toBe(true);
    });

    describe("isAdminConsoleAction is true", () => {
      it("should return true for admin users", async () => {
        const cipher = createMockCipher("org1", []) as CipherView;
        const organization = createMockOrganization({ isAdmin: true });
        mockOrganizationService.organizations$.mockReturnValue(
          of([organization] as Organization[]),
        );

        const result = await firstValueFrom(
          cipherAuthorizationService.canCloneCipher$(cipher, true),
        );
        expect(result).toBe(true);
      });

      it("should return true for custom user with canEditAnyCollection", async () => {
        const cipher = createMockCipher("org1", []) as CipherView;
        const organization = createMockOrganization({ editAnyCollection: true });
        mockOrganizationService.organizations$.mockReturnValue(
          of([organization] as Organization[]),
        );

        const result = await firstValueFrom(
          cipherAuthorizationService.canCloneCipher$(cipher, true),
        );
        expect(result).toBe(true);
      });
    });

    describe("isAdminConsoleAction is false", () => {
      it("should return true if at least one cipher collection has manage permission", async () => {
        const cipher = createMockCipher("org1", ["col1", "col2"]) as CipherView;
        const organization = createMockOrganization();
        mockOrganizationService.organizations$.mockReturnValue(
          of([organization] as Organization[]),
        );

        const allCollections = [
          createMockCollection("col1", true),
          createMockCollection("col2", false),
        ];
        mockCollectionService.decryptedCollections$.mockReturnValue(
          of(allCollections as CollectionView[]),
        );

        const result = await firstValueFrom(cipherAuthorizationService.canCloneCipher$(cipher));
        expect(result).toBe(true);
      });

      it("should return false if no collection has manage permission", async () => {
        const cipher = createMockCipher("org1", ["col1", "col2"]) as CipherView;
        const organization = createMockOrganization();
        mockOrganizationService.organizations$.mockReturnValue(
          of([organization] as Organization[]),
        );

        const allCollections = [
          createMockCollection("col1", false),
          createMockCollection("col2", false),
        ];
        mockCollectionService.decryptedCollections$.mockReturnValue(
          of(allCollections as CollectionView[]),
        );

        const result = await firstValueFrom(cipherAuthorizationService.canCloneCipher$(cipher));
        expect(result).toBe(false);
      });
    });
  });
});
