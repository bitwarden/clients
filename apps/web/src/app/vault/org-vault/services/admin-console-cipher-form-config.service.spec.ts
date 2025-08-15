import { TestBed } from "@angular/core/testing";
import { BehaviorSubject, of } from "rxjs";

import { CollectionAdminService, CollectionAdminView } from "@bitwarden/admin-console/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { OrganizationUserStatusType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { CipherId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";

import { RoutedVaultFilterService } from "../../individual-vault/vault-filter/services/routed-vault-filter.service";

import { AdminConsoleCipherFormConfigService } from "./admin-console-cipher-form-config.service";

describe("AdminConsoleCipherFormConfigService", () => {
  let adminConsoleConfigService: AdminConsoleCipherFormConfigService;

  const cipherId = "333-444-555" as CipherId;
  const testOrg = {
    id: "333-44-55",
    name: "Test Org",
    canEditAllCiphers: false,
    isMember: true,
    enabled: true,
    status: OrganizationUserStatusType.Confirmed,
    userId: "UserId",
  };
  const testOrg2 = {
    id: "333-999-888",
    name: "Test Org 2",
    canEditAllCiphers: false,
    isMember: true,
    enabled: true,
    status: OrganizationUserStatusType.Confirmed,
    userId: "UserId",
  };
  const policyAppliesToUser$ = new BehaviorSubject<boolean>(true);
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

  const orgs$ = new BehaviorSubject<Organization[]>([testOrg, testOrg2] as Organization[]);
  const getCipherAdmin = jest.fn().mockResolvedValue(null);
  const getCipher = jest.fn().mockResolvedValue(null);

  beforeEach(async () => {
    getCipherAdmin.mockClear();
    getCipherAdmin.mockResolvedValue({ id: cipherId, name: "Test Cipher - (admin)" });

    getCipher.mockClear();
    getCipher.mockResolvedValue({ id: cipherId, name: "Test Cipher" });

    TestBed.configureTestingModule({
      providers: [
        AdminConsoleCipherFormConfigService,
        { provide: OrganizationService, useValue: { organizations$: () => orgs$ } },
        {
          provide: CollectionAdminService,
          useValue: { collectionAdminViews$: () => of([collection, collection2]) },
        },
        {
          provide: PolicyService,
          useValue: { policyAppliesToUser$: () => policyAppliesToUser$ },
        },
        {
          provide: RoutedVaultFilterService,
          useValue: { filter$: new BehaviorSubject({ organizationId: testOrg.id }) },
        },
        { provide: ApiService, useValue: { getCipherAdmin } },
        { provide: CipherService, useValue: { get: getCipher } },
        { provide: AccountService, useValue: mockAccountServiceWith("UserId" as UserId) },
      ],
    });
    adminConsoleConfigService = TestBed.inject(AdminConsoleCipherFormConfigService);
  });

  describe("buildConfig", () => {
    it("sets individual attributes", async () => {
      const { folders, hideIndividualVaultFields } = await adminConsoleConfigService.buildConfig(
        "add",
        cipherId,
      );

      expect(folders).toEqual([]);
      expect(hideIndividualVaultFields).toBe(true);
    });

    it("sets mode based on passed mode", async () => {
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

    it("sets `organizationDataOwnershipDisabled`", async () => {
      policyAppliesToUser$.next(true);

      let result = await adminConsoleConfigService.buildConfig("clone", cipherId);

      expect(result.organizationDataOwnershipDisabled).toBe(false);

      policyAppliesToUser$.next(false);

      result = await adminConsoleConfigService.buildConfig("clone", cipherId);

      expect(result.organizationDataOwnershipDisabled).toBe(true);
    });

    it("disables personal ownership when not cloning", async () => {
      policyAppliesToUser$.next(false);

      let result = await adminConsoleConfigService.buildConfig("add", cipherId);

      expect(result.organizationDataOwnershipDisabled).toBe(false);

      result = await adminConsoleConfigService.buildConfig("edit", cipherId);

      expect(result.organizationDataOwnershipDisabled).toBe(false);

      result = await adminConsoleConfigService.buildConfig("clone", cipherId);

      expect(result.organizationDataOwnershipDisabled).toBe(true);
    });

    it("returns all ciphers when cloning a cipher", async () => {
      // Add cipher
      let result = await adminConsoleConfigService.buildConfig("add", cipherId);

      expect(result.organizations).toEqual([testOrg]);

      // Edit cipher
      result = await adminConsoleConfigService.buildConfig("edit", cipherId);

      expect(result.organizations).toEqual([testOrg]);

      // Clone cipher
      result = await adminConsoleConfigService.buildConfig("clone", cipherId);

      expect(result.organizations).toEqual([testOrg, testOrg2]);
    });

    it("retrieves the cipher from the admin service when canEditAllCiphers is true", async () => {
      getCipherAdmin.mockResolvedValue({ id: cipherId, name: "Test Cipher - (admin)" });
      testOrg.canEditAllCiphers = true;

      await adminConsoleConfigService.buildConfig("edit", cipherId);

      expect(getCipherAdmin).toHaveBeenCalledWith(cipherId);
    });

    it("retrieves the cipher from the admin service when not found in local state", async () => {
      getCipherAdmin.mockResolvedValue({ id: cipherId, name: "Test Cipher - (admin)" });
      testOrg.canEditAllCiphers = false;
      getCipher.mockResolvedValue(null);

      await adminConsoleConfigService.buildConfig("edit", cipherId);

      expect(getCipherAdmin).toHaveBeenCalledWith(cipherId);
    });

    it("retrieves the cipher from local state when admin is not required", async () => {
      testOrg.canEditAllCiphers = false;

      await adminConsoleConfigService.buildConfig("edit", cipherId);

      expect(getCipherAdmin).not.toHaveBeenCalled();
      expect(getCipher).toHaveBeenCalledWith(cipherId, "UserId");
    });
  });
});
