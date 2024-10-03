import { TestBed } from "@angular/core/testing";
import { FormBuilder } from "@angular/forms";
import { BehaviorSubject, skipWhile } from "rxjs";

import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CollectionService } from "@bitwarden/common/vault/abstractions/collection.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums";
import { Collection } from "@bitwarden/common/vault/models/domain/collection";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { CollectionView } from "@bitwarden/common/vault/models/view/collection.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";

import { MY_VAULT_ID, VaultPopupListFiltersService } from "./vault-popup-list-filters.service";

describe("VaultPopupListFiltersService", () => {
  let service: VaultPopupListFiltersService;
  const memberOrganizations$ = new BehaviorSubject<Organization[]>([]);
  const folderViews$ = new BehaviorSubject([]);
  const cipherViews$ = new BehaviorSubject({});
  const decryptedCollections$ = new BehaviorSubject<CollectionView[]>([]);
  const policyAppliesToActiveUser$ = new BehaviorSubject<boolean>(false);

  const collectionService = {
    decryptedCollections$,
    getAllNested: () => Promise.resolve([]),
  } as unknown as CollectionService;

  const folderService = {
    folderViews$,
  } as unknown as FolderService;

  const cipherService = {
    cipherViews$,
  } as unknown as CipherService;

  const organizationService = {
    memberOrganizations$,
  } as unknown as OrganizationService;

  const i18nService = {
    t: (key: string) => key,
  } as I18nService;

  const policyService = {
    policyAppliesToActiveUser$: jest.fn(() => policyAppliesToActiveUser$),
  };

  beforeEach(() => {
    memberOrganizations$.next([]);
    decryptedCollections$.next([]);
    policyAppliesToActiveUser$.next(false);
    policyService.policyAppliesToActiveUser$.mockClear();

    collectionService.getAllNested = () => Promise.resolve([]);
    TestBed.configureTestingModule({
      providers: [
        {
          provide: FolderService,
          useValue: folderService,
        },
        {
          provide: CipherService,
          useValue: cipherService,
        },
        {
          provide: OrganizationService,
          useValue: organizationService,
        },
        {
          provide: I18nService,
          useValue: i18nService,
        },
        {
          provide: CollectionService,
          useValue: collectionService,
        },
        {
          provide: PolicyService,
          useValue: policyService,
        },
        { provide: FormBuilder, useClass: FormBuilder },
      ],
    });

    service = TestBed.inject(VaultPopupListFiltersService);
  });

  describe("cipherTypes", () => {
    it("returns all cipher types", () => {
      expect(service.cipherTypes.map((c) => c.value)).toEqual([
        CipherType.Login,
        CipherType.Card,
        CipherType.Identity,
        CipherType.SecureNote,
        CipherType.SshKey,
      ]);
    });
  });

  describe("organizations$", () => {
    it('does not add "myVault" to the list of organizations when there are no organizations', (done) => {
      memberOrganizations$.next([]);

      service.organizations$.subscribe((organizations) => {
        expect(organizations.map((o) => o.label)).toEqual([]);
        done();
      });
    });

    it('adds "myVault" to the list of organizations when there are other organizations', (done) => {
      const orgs = [{ name: "bobby's org", id: "1234-3323-23223" }] as Organization[];
      memberOrganizations$.next(orgs);

      service.organizations$.subscribe((organizations) => {
        expect(organizations.map((o) => o.label)).toEqual(["myVault", "bobby's org"]);
        done();
      });
    });

    it("sorts organizations by name", (done) => {
      const orgs = [
        { name: "bobby's org", id: "1234-3323-23223" },
        { name: "alice's org", id: "2223-4343-99888" },
      ] as Organization[];
      memberOrganizations$.next(orgs);

      service.organizations$.subscribe((organizations) => {
        expect(organizations.map((o) => o.label)).toEqual([
          "myVault",
          "alice's org",
          "bobby's org",
        ]);
        done();
      });
    });

    describe("PersonalOwnership policy", () => {
      it('calls policyAppliesToActiveUser$ with "PersonalOwnership"', () => {
        expect(policyService.policyAppliesToActiveUser$).toHaveBeenCalledWith(
          PolicyType.PersonalOwnership,
        );
      });

      it("returns an empty array when the policy applies and there is a single organization", (done) => {
        policyAppliesToActiveUser$.next(true);
        memberOrganizations$.next([
          { name: "bobby's org", id: "1234-3323-23223" },
        ] as Organization[]);

        service.organizations$.subscribe((organizations) => {
          expect(organizations).toEqual([]);
          done();
        });
      });

      it('adds "myVault" when the policy does not apply and there are multiple organizations', (done) => {
        policyAppliesToActiveUser$.next(false);
        const orgs = [
          { name: "bobby's org", id: "1234-3323-23223" },
          { name: "alice's org", id: "2223-4343-99888" },
        ] as Organization[];

        memberOrganizations$.next(orgs);

        service.organizations$.subscribe((organizations) => {
          expect(organizations.map((o) => o.label)).toEqual([
            "myVault",
            "alice's org",
            "bobby's org",
          ]);
          done();
        });
      });

      it('does not add "myVault" the policy applies and there are multiple organizations', (done) => {
        policyAppliesToActiveUser$.next(true);
        const orgs = [
          { name: "bobby's org", id: "1234-3323-23223" },
          { name: "alice's org", id: "2223-3242-99888" },
          { name: "catherine's org", id: "77733-4343-99888" },
        ] as Organization[];

        memberOrganizations$.next(orgs);

        service.organizations$.subscribe((organizations) => {
          expect(organizations.map((o) => o.label)).toEqual([
            "alice's org",
            "bobby's org",
            "catherine's org",
          ]);
          done();
        });
      });
    });

    describe("icons", () => {
      it("sets family icon for family organizations", (done) => {
        const orgs = [
          {
            name: "family org",
            id: "1234-3323-23223",
            enabled: true,
            productTierType: ProductTierType.Families,
          },
        ] as Organization[];

        memberOrganizations$.next(orgs);

        service.organizations$.subscribe((organizations) => {
          expect(organizations.map((o) => o.icon)).toEqual(["bwi-user", "bwi-family"]);
          done();
        });
      });

      it("sets family icon for free organizations", (done) => {
        const orgs = [
          {
            name: "free org",
            id: "1234-3323-23223",
            enabled: true,
            productTierType: ProductTierType.Free,
          },
        ] as Organization[];

        memberOrganizations$.next(orgs);

        service.organizations$.subscribe((organizations) => {
          expect(organizations.map((o) => o.icon)).toEqual(["bwi-user", "bwi-family"]);
          done();
        });
      });

      it("sets warning icon for disabled organizations", (done) => {
        const orgs = [
          {
            name: "free org",
            id: "1234-3323-23223",
            enabled: false,
            productTierType: ProductTierType.Free,
          },
        ] as Organization[];

        memberOrganizations$.next(orgs);

        service.organizations$.subscribe((organizations) => {
          expect(organizations.map((o) => o.icon)).toEqual([
            "bwi-user",
            "bwi-exclamation-triangle tw-text-danger",
          ]);
          done();
        });
      });
    });
  });

  describe("collections$", () => {
    const testCollection = {
      id: "14cbf8e9-7a2a-4105-9bf6-b15c01203cef",
      name: "Test collection",
      organizationId: "3f860945-b237-40bc-a51e-b15c01203ccf",
    } as CollectionView;

    const testCollection2 = {
      id: "b15c0120-7a2a-4105-9bf6-b15c01203ceg",
      name: "Test collection 2",
      organizationId: "1203ccf-2432-123-acdd-b15c01203ccf",
    } as CollectionView;

    const testCollections = [testCollection, testCollection2];

    beforeEach(() => {
      decryptedCollections$.next(testCollections);

      collectionService.getAllNested = () =>
        Promise.resolve(
          testCollections.map((c) => ({
            children: [],
            node: c,
            parent: null,
          })),
        );
    });

    it("returns all collections", (done) => {
      service.collections$.subscribe((collections) => {
        expect(collections.map((c) => c.label)).toEqual(["Test collection", "Test collection 2"]);
        done();
      });
    });

    it("filters out collections that do not belong to an organization", () => {
      service.filterForm.patchValue({
        organization: { id: testCollection2.organizationId } as Organization,
      });

      service.collections$.subscribe((collections) => {
        expect(collections.map((c) => c.label)).toEqual(["Test collection 2"]);
      });
    });

    it("sets collection icon", (done) => {
      service.collections$.subscribe((collections) => {
        expect(collections.every(({ icon }) => icon === "bwi-collection")).toBeTruthy();
        done();
      });
    });
  });

  describe("folders$", () => {
    it('returns no folders when "No Folder" is the only option', (done) => {
      folderViews$.next([{ id: null, name: "No Folder" }]);

      service.folders$.subscribe((folders) => {
        expect(folders).toEqual([]);
        done();
      });
    });

    it('moves "No Folder" to the end of the list', (done) => {
      folderViews$.next([
        { id: null, name: "No Folder" },
        { id: "2345", name: "Folder 2" },
        { id: "1234", name: "Folder 1" },
      ]);

      service.folders$.subscribe((folders) => {
        expect(folders.map((f) => f.label)).toEqual(["Folder 1", "Folder 2", "itemsWithNoFolder"]);
        done();
      });
    });

    it("returns all folders when MyVault is selected", (done) => {
      service.filterForm.patchValue({
        organization: { id: MY_VAULT_ID } as Organization,
      });

      folderViews$.next([
        { id: "1234", name: "Folder 1" },
        { id: "2345", name: "Folder 2" },
      ]);

      service.folders$.subscribe((folders) => {
        expect(folders.map((f) => f.label)).toEqual(["Folder 1", "Folder 2"]);
        done();
      });
    });

    it("sets folder icon", (done) => {
      service.filterForm.patchValue({
        organization: { id: MY_VAULT_ID } as Organization,
      });

      folderViews$.next([
        { id: "1234", name: "Folder 1" },
        { id: "2345", name: "Folder 2" },
      ]);

      service.folders$.subscribe((folders) => {
        expect(folders.every(({ icon }) => icon === "bwi-folder")).toBeTruthy();
        done();
      });
    });

    it("returns folders that have ciphers within the selected organization", (done) => {
      service.folders$.pipe(skipWhile((folders) => folders.length === 2)).subscribe((folders) => {
        expect(folders.map((f) => f.label)).toEqual(["Folder 1"]);
        done();
      });

      service.filterForm.patchValue({
        organization: { id: "1234" } as Organization,
      });

      folderViews$.next([
        { id: "1234", name: "Folder 1" },
        { id: "2345", name: "Folder 2" },
      ]);

      cipherViews$.next({
        "1": { folderId: "1234", organizationId: "1234" },
        "2": { folderId: "2345", organizationId: "56789" },
      });
    });
  });

  describe("filterFunction$", () => {
    const ciphers = [
      { type: CipherType.Login, collectionIds: [], organizationId: null },
      { type: CipherType.Card, collectionIds: ["1234"], organizationId: "8978" },
      { type: CipherType.Identity, collectionIds: [], folderId: "5432", organizationId: null },
      { type: CipherType.SecureNote, collectionIds: [], organizationId: null },
    ] as CipherView[];

    it("filters by cipherType", (done) => {
      service.filterFunction$.subscribe((filterFunction) => {
        expect(filterFunction(ciphers)).toEqual([ciphers[0]]);
        done();
      });

      service.filterForm.patchValue({ cipherType: CipherType.Login });
    });

    it("filters by collection", (done) => {
      const collection = { id: "1234" } as Collection;

      service.filterFunction$.subscribe((filterFunction) => {
        expect(filterFunction(ciphers)).toEqual([ciphers[1]]);
        done();
      });

      service.filterForm.patchValue({ collection });
    });

    it("filters by folder", (done) => {
      const folder = { id: "5432" } as FolderView;

      service.filterFunction$.subscribe((filterFunction) => {
        expect(filterFunction(ciphers)).toEqual([ciphers[2]]);
        done();
      });

      service.filterForm.patchValue({ folder });
    });

    describe("organizationId", () => {
      it("filters out ciphers that belong to an organization when MyVault is selected", (done) => {
        const organization = { id: MY_VAULT_ID } as Organization;

        service.filterFunction$.subscribe((filterFunction) => {
          expect(filterFunction(ciphers)).toEqual([ciphers[0], ciphers[2], ciphers[3]]);
          done();
        });

        service.filterForm.patchValue({ organization });
      });

      it("filters out ciphers that do not belong to the selected organization", (done) => {
        const organization = { id: "8978" } as Organization;

        service.filterFunction$.subscribe((filterFunction) => {
          expect(filterFunction(ciphers)).toEqual([ciphers[1]]);
          done();
        });

        service.filterForm.patchValue({ organization });
      });
    });
  });
});
