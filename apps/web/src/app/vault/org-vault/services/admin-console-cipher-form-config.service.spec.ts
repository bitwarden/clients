import { TestBed } from "@angular/core/testing";
import { BehaviorSubject } from "rxjs";

import { CollectionAdminService, CollectionAdminView } from "@bitwarden/admin-console/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { CipherId } from "@bitwarden/common/types/guid";

import { RoutedVaultFilterService } from "../../individual-vault/vault-filter/services/routed-vault-filter.service";

import { AdminConsoleCipherFormConfigService } from "./admin-console-cipher-form-config.service";

describe("AdminConsoleCipherFormConfigService", () => {
  let adminConsoleConfigService: AdminConsoleCipherFormConfigService;

  const cipherId = "333-444-555" as CipherId;
  const testOrg = { id: "333-44-55", name: "Test Org", canEditAllCiphers: false };
  const collection = {
    id: "12345-5555",
    organizationId: "234534-34334",
    name: "Test Collection 1",
    assigned: false,
    readOnly: true,
  } as CollectionAdminView;
  const collection2 = {
    id: "12345-6666",
    organizationId: "22222-2222",
    name: "Test Collection 2",
    assigned: true,
    readOnly: false,
  } as CollectionAdminView;
  const organization$ = new BehaviorSubject<Organization>(testOrg as Organization);
  const getCipherAdmin = jest.fn().mockResolvedValue(null);

  beforeEach(async () => {
    getCipherAdmin.mockClear();
    getCipherAdmin.mockResolvedValue({ id: cipherId, name: "Test Cipher - (admin)" });

    await TestBed.configureTestingModule({
      providers: [
        AdminConsoleCipherFormConfigService,
        { provide: OrganizationService, useValue: { get$: () => organization$ } },
        {
          provide: CollectionAdminService,
          useValue: { getAll: () => Promise.resolve([collection, collection2]) },
        },
        {
          provide: RoutedVaultFilterService,
          useValue: { filter$: new BehaviorSubject({ organizationId: testOrg.id }) },
        },
        { provide: ApiService, useValue: { getCipherAdmin } },
      ],
    });
  });

  describe("buildConfig", () => {
    it("sets individual attributes", async () => {
      adminConsoleConfigService = TestBed.inject(AdminConsoleCipherFormConfigService);

      const { folders, hideIndividualVaultFields } = await adminConsoleConfigService.buildConfig(
        "add",
        cipherId,
      );

      expect(folders).toEqual([]);
      expect(hideIndividualVaultFields).toBe(true);
    });

    it("sets mode based on passed mode", async () => {
      adminConsoleConfigService = TestBed.inject(AdminConsoleCipherFormConfigService);

      const { mode } = await adminConsoleConfigService.buildConfig("edit", cipherId);

      expect(mode).toBe("edit");
    });

    it("returns all collections", async () => {
      const { collections } = await adminConsoleConfigService.buildConfig("edit", cipherId);

      expect(collections).toEqual([collection, collection2]);
    });

    it("sets admin flag based on `canEditAllCiphers`", async () => {
      // Disable edit all ciphers on org
      testOrg.canEditAllCiphers = false;
      adminConsoleConfigService = TestBed.inject(AdminConsoleCipherFormConfigService);

      let result = await adminConsoleConfigService.buildConfig("add", cipherId);

      expect(result.admin).toBe(false);

      // Enable edit all ciphers on org
      testOrg.canEditAllCiphers = true;
      result = await adminConsoleConfigService.buildConfig("add", cipherId);

      expect(result.admin).toBe(true);
    });

    it("sets `allowPersonalOwnership` to false", async () => {
      adminConsoleConfigService = TestBed.inject(AdminConsoleCipherFormConfigService);

      const result = await adminConsoleConfigService.buildConfig("clone", cipherId);

      expect(result.allowPersonalOwnership).toBe(false);
    });

    it("retrieves the cipher from the admin service", async () => {
      getCipherAdmin.mockResolvedValue({ id: cipherId, name: "Test Cipher - (admin)" });

      adminConsoleConfigService = TestBed.inject(AdminConsoleCipherFormConfigService);

      await adminConsoleConfigService.buildConfig("add", cipherId);

      expect(getCipherAdmin).toHaveBeenCalledWith(cipherId);
    });
  });
});
