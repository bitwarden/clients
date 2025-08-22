import { Injector, WritableSignal, runInInjectionContext, signal } from "@angular/core";
import { TestBed, discardPeriodicTasks, fakeAsync, tick } from "@angular/core/testing";
import { FormBuilder } from "@angular/forms";
import { BehaviorSubject, skipWhile } from "rxjs";

import { CollectionService, CollectionView } from "@bitwarden/admin-console/common";
import { ViewCacheService } from "@bitwarden/angular/platform/view-cache";
import * as vaultFilterSvc from "@bitwarden/angular/vault/vault-filter/services/vault-filter.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { StateProvider } from "@bitwarden/common/platform/state";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherType } from "@bitwarden/common/vault/enums";
import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import {
  RestrictedCipherType,
  RestrictedItemTypesService,
} from "@bitwarden/common/vault/services/restricted-item-types.service";

import { PopupCipherViewLike } from "../views/popup-cipher.view";

import {
  CachedFilterState,
  MY_VAULT_ID,
  VaultPopupListFiltersService,
} from "./vault-popup-list-filters.service";

const configService = {
  getFeatureFlag$: jest.fn(() => new BehaviorSubject<boolean>(true)),
} as unknown as ConfigService;

jest.mock("@bitwarden/angular/vault/vault-filter/services/vault-filter.service", () => ({
  sortDefaultCollections: jest.fn(),
}));

describe("VaultPopupListFiltersService", () => {
  let service: VaultPopupListFiltersService;
  let _memberOrganizations$ = new BehaviorSubject<Organization[]>([]);
  const memberOrganizations$ = (userId: UserId) => _memberOrganizations$;
  const organizations$ = new BehaviorSubject<Organization[]>([]);
  let folderViews$ = new BehaviorSubject([]);
  const cipherListViews$ = new BehaviorSubject({});
  let decryptedCollections$ = new BehaviorSubject<CollectionView[]>([]);
  const policyAppliesToUser$ = new BehaviorSubject<boolean>(false);
  let viewCacheService: {
    signal: jest.Mock;
    mockSignal: WritableSignal<CachedFilterState>;
  };

  const collectionService = {
    decryptedCollections$: () => decryptedCollections$,
    getAllNested: () => Promise.resolve([]),
  } as unknown as CollectionService;

  const folderService = {
    folderViews$: () => folderViews$,
  } as unknown as FolderService;

  const cipherService = {
    cipherListViews$: () => cipherListViews$,
  } as unknown as CipherService;

  const organizationService = {
    memberOrganizations$,
    organizations$,
  } as unknown as OrganizationService;

  const i18nService = {
    t: (key: string) => key,
  } as I18nService;

  const policyService = {
    policyAppliesToUser$: jest.fn(() => policyAppliesToUser$),
  };

  const state$ = new BehaviorSubject<boolean>(false);
  const update = jest.fn().mockResolvedValue(undefined);

  const restrictedItemTypesService = {
    restricted$: new BehaviorSubject<RestrictedCipherType[]>([]),
    isCipherRestricted: jest.fn().mockReturnValue(false),
  };

  beforeEach(() => {
    _memberOrganizations$ = new BehaviorSubject<Organization[]>([]); // Fresh instance per test
    folderViews$ = new BehaviorSubject([]); // Fresh instance per test
    decryptedCollections$ = new BehaviorSubject<CollectionView[]>([]); // Fresh instance per test
    policyAppliesToUser$.next(false);
    policyService.policyAppliesToUser$.mockClear();

    const accountService = mockAccountServiceWith("userId" as UserId);
    const mockCachedSignal = createMockSignal<CachedFilterState>({});

    viewCacheService = {
      mockSignal: mockCachedSignal,
      signal: jest.fn(() => mockCachedSignal),
    };

    collectionService.getAllNested = () => [];
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
        {
          provide: StateProvider,
          useValue: { getGlobal: () => ({ state$, update }) },
        },
        { provide: FormBuilder, useClass: FormBuilder },
        {
          provide: AccountService,
          useValue: accountService,
        },
        {
          provide: ViewCacheService,
          useValue: viewCacheService,
        },
        {
          provide: RestrictedItemTypesService,
          useValue: restrictedItemTypesService,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    });

    service = TestBed.inject(VaultPopupListFiltersService);
  });

  describe("cipherTypes$", () => {
    it("returns all cipher types when no restrictions", (done) => {
      restrictedItemTypesService.restricted$.next([]);

      service.cipherTypes$.subscribe((cipherTypes) => {
        expect(cipherTypes.map((c) => c.value)).toEqual([
          CipherType.Login,
          CipherType.Card,
          CipherType.Identity,
          CipherType.SecureNote,
          CipherType.SshKey,
        ]);
        done();
      });
    });

    it("filters out restricted cipher types", (done) => {
      restrictedItemTypesService.restricted$.next([
        { cipherType: CipherType.Card, allowViewOrgIds: [] },
      ]);

      service.cipherTypes$.subscribe((cipherTypes) => {
        expect(cipherTypes.map((c) => c.value)).toEqual([
          CipherType.Login,
          CipherType.Identity,
          CipherType.SecureNote,
          CipherType.SshKey,
        ]);
        done();
      });
    });
  });

  describe("numberOfAppliedFilters$", () => {
    it("updates as the form value changes", (done) => {
      service.numberOfAppliedFilters$.subscribe((number) => {
        expect(number).toBe(2);
        done();
      });

      service.filterForm.patchValue({
        organization: { id: "1234" } as Organization,
        folder: { id: "folder11" } as FolderView,
      });
    });
  });

  describe("organizations$", () => {
    it('does not add "myVault" to the list of organizations when there are no organizations', (done) => {
      _memberOrganizations$.next([]);

      service.organizations$.subscribe((organizations) => {
        expect(organizations.map((o) => o.label)).toEqual([]);
        done();
      });
    });

    it('adds "myVault" to the list of organizations when there are other organizations', (done) => {
      const orgs = [{ name: "bobby's org", id: "1234-3323-23223" }] as Organization[];
      _memberOrganizations$.next(orgs);

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
      _memberOrganizations$.next(orgs);

      service.organizations$.subscribe((organizations) => {
        expect(organizations.map((o) => o.label)).toEqual([
          "myVault",
          "alice's org",
          "bobby's org",
        ]);
        done();
      });
    });

    describe("OrganizationDataOwnership policy", () => {
      it('calls policyAppliesToUser$ with "OrganizationDataOwnership"', () => {
        expect(policyService.policyAppliesToUser$).toHaveBeenCalledWith(
          PolicyType.OrganizationDataOwnership,
          "userId",
        );
      });

      it("returns an empty array when the policy applies and there is a single organization", (done) => {
        policyAppliesToUser$.next(true);
        _memberOrganizations$.next([
          { name: "bobby's org", id: "1234-3323-23223" },
        ] as Organization[]);

        service.organizations$.subscribe((organizations) => {
          expect(organizations).toEqual([]);
          done();
        });
      });

      it('adds "myVault" when the policy does not apply and there are multiple organizations', (done) => {
        policyAppliesToUser$.next(false);
        const orgs = [
          { name: "bobby's org", id: "1234-3323-23223" },
          { name: "alice's org", id: "2223-4343-99888" },
        ] as Organization[];

        _memberOrganizations$.next(orgs);

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
        policyAppliesToUser$.next(true);
        const orgs = [
          { name: "bobby's org", id: "1234-3323-23223" },
          { name: "alice's org", id: "2223-3242-99888" },
          { name: "catherine's org", id: "77733-4343-99888" },
        ] as Organization[];

        _memberOrganizations$.next(orgs);

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

        _memberOrganizations$.next(orgs);

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

        _memberOrganizations$.next(orgs);

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

        _memberOrganizations$.next(orgs);

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

      collectionService.getAllNested = () => testCollections.map((c) => new TreeNode(c, null));
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
        expect(collections.every(({ icon }) => icon === "bwi-collection-shared")).toBeTruthy();
        done();
      });
    });

    it("calls vaultFilterService.sortDefaultCollections", (done) => {
      const collections = [
        { id: "1234", name: "Default Collection", organizationId: "org1" },
        { id: "5678", name: "Shared Collection", organizationId: "org2" },
      ] as CollectionView[];

      const orgs = [
        { id: "org1", name: "Organization 1" },
        { id: "org2", name: "Organization 2" },
      ] as Organization[];

      createSeededVaultPopupListFiltersService(orgs, collections, [], {});

      service.collections$.subscribe(() => {
        expect(vaultFilterSvc.sortDefaultCollections).toHaveBeenCalledWith(
          collections,
          orgs,
          i18nService.collator,
        );
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

      cipherListViews$.next({
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
      const collection = { id: "1234" } as CollectionView;

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

      it("keeps ciphers with null and undefined for organizationId when MyVault is selected", (done) => {
        const organization = { id: MY_VAULT_ID } as Organization;

        const undefinedOrgIdCipher = {
          type: CipherType.SecureNote,
          collectionIds: [],
          organizationId: undefined,
        } as unknown as PopupCipherViewLike;

        service.filterFunction$.subscribe((filterFunction) => {
          expect(filterFunction([...ciphers, undefinedOrgIdCipher])).toEqual([
            ciphers[0],
            ciphers[2],
            ciphers[3],
            undefinedOrgIdCipher,
          ]);
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

  describe("filterVisibilityState", () => {
    it("exposes stored state through filterVisibilityState$", (done) => {
      state$.next(true);

      service.filterVisibilityState$.subscribe((filterVisibility) => {
        expect(filterVisibility).toBe(true);
        done();
      });
    });

    it("updates stored filter state", async () => {
      await service.updateFilterVisibility(false);

      expect(update).toHaveBeenCalledTimes(1);
      // Get callback passed to `update`
      const updateCallback = update.mock.calls[0][0];
      expect(updateCallback()).toBe(false);
    });
  });

  describe("caching", () => {
    it("initializes form from cached state", fakeAsync(() => {
      const cachedState: CachedFilterState = {
        organizationId: MY_VAULT_ID,
        collectionId: "test-collection-id",
        folderId: "test-folder-id",
        cipherType: CipherType.Login,
      };

      const seededOrganizations: Organization[] = [
        { id: MY_VAULT_ID, name: "Test Org" } as Organization,
        { id: "org1", name: "Default User Collection Org 1" } as Organization,
        { id: "org2", name: "Default User Collection Org 2" } as Organization,
      ];
      const seededCollections: CollectionView[] = [
        {
          id: "test-collection-id",
          organizationId: MY_VAULT_ID,
          name: "Test collection",
        } as CollectionView,
      ];
      const seededFolderViews: FolderView[] = [
        { id: "test-folder-id", name: "Test Folder" } as FolderView,
      ];

      const { service } = createSeededVaultPopupListFiltersService(
        seededOrganizations,
        seededCollections,
        seededFolderViews,
        cachedState,
      );

      tick();

      expect(service.filterForm.value).toEqual({
        organization: { id: MY_VAULT_ID },
        collection: {
          id: "test-collection-id",
          organizationId: MY_VAULT_ID,
          name: "Test collection",
        },
        folder: { id: "test-folder-id", name: "Test Folder" },
        cipherType: CipherType.Login,
      });
      discardPeriodicTasks();
    }));

    it("serializes filters to cache on changes", fakeAsync(() => {
      const seededOrganizations: Organization[] = [
        { id: "test-org-id", name: "Org" } as Organization,
      ];
      const seededCollections: CollectionView[] = [
        {
          id: "test-collection-id",
          organizationId: "test-org-id",
          name: "Test collection",
        } as CollectionView,
      ];
      const seededFolderViews: FolderView[] = [
        { id: "test-folder-id", name: "Test Folder" } as FolderView,
      ];

      const { service, cachedSignal } = createSeededVaultPopupListFiltersService(
        seededOrganizations,
        seededCollections,
        seededFolderViews,
        {},
      );
      const testOrg = { id: "test-org-id", name: "Org" } as Organization;
      const testCollection = {
        id: "test-collection-id",
        organizationId: "test-org-id",
        name: "Test collection",
      } as CollectionView;
      const testFolder = { id: "test-folder-id", name: "Test Folder" } as FolderView;

      service.filterForm.patchValue({
        organization: testOrg,
        collection: testCollection,
        folder: testFolder,
        cipherType: CipherType.Card,
      });

      tick(300);

      // force another emission by patching with the same value again. workaround for debounce times
      service.filterForm.patchValue({
        organization: testOrg,
        collection: testCollection,
        folder: testFolder,
        cipherType: CipherType.Card,
      });

      tick(300);

      expect(cachedSignal()).toEqual({
        organizationId: "test-org-id",
        collectionId: "test-collection-id",
        folderId: "test-folder-id",
        cipherType: CipherType.Card,
      });
      discardPeriodicTasks();
    }));
  });
});

function createMockSignal<T>(initialValue: T): WritableSignal<T> {
  const s = signal(initialValue);
  s.set = (value: T) => s.update(() => value);
  return s;
}

// Helper function to create a seeded VaultPopupListFiltersService
function createSeededVaultPopupListFiltersService(
  organizations: Organization[],
  collections: CollectionView[],
  folderViews: FolderView[],
  cachedState: CachedFilterState = {},
): {
  service: VaultPopupListFiltersService;
  cachedSignal: WritableSignal<CachedFilterState>;
} {
  const seededMemberOrganizations$ = new BehaviorSubject<Organization[]>(organizations);
  const seededCollections$ = new BehaviorSubject<CollectionView[]>(collections);
  const seededFolderViews$ = new BehaviorSubject<FolderView[]>(folderViews);

  const organizationServiceMock = {
    memberOrganizations$: (userId: string) => seededMemberOrganizations$,
    organizations$: seededMemberOrganizations$,
  } as any;

  const collectionServiceMock = {
    decryptedCollections$: () => seededCollections$,
    getAllNested: () =>
      seededCollections$.value.map((c) => ({
        children: [],
        node: c,
        parent: null,
      })),
  } as any;

  const folderServiceMock = {
    folderViews$: () => seededFolderViews$,
  } as any;

  const cipherServiceMock = {
    cipherListViews$: () => new BehaviorSubject({}),
  } as any;

  const i18nServiceMock = {
    t: (key: string) => key,
  } as any;

  const policyServiceMock = {
    policyAppliesToUser$: jest.fn(() => new BehaviorSubject(false)),
  } as any;

  const stateProviderMock = {
    getGlobal: () => ({
      state$: new BehaviorSubject(false),
      update: jest.fn().mockResolvedValue(undefined),
    }),
  } as any;

  const accountServiceMock = mockAccountServiceWith("userId" as UserId);
  const restrictedItemTypesServiceMock = {
    restricted$: new BehaviorSubject<RestrictedCipherType[]>([]),
    isCipherRestricted: jest.fn().mockReturnValue(false),
  } as any;
  const formBuilderInstance = new FormBuilder();

  const seededCachedSignal = createMockSignal<CachedFilterState>(cachedState);
  const viewCacheServiceMock = {
    signal: jest.fn(() => seededCachedSignal),
    mockSignal: seededCachedSignal,
  } as any;

  // Get an injector from TestBed so that we can run in an injection context.
  const injector = TestBed.inject(Injector);
  let service: VaultPopupListFiltersService;
  runInInjectionContext(injector, () => {
    service = new VaultPopupListFiltersService(
      folderServiceMock,
      cipherServiceMock,
      organizationServiceMock,
      i18nServiceMock,
      collectionServiceMock,
      formBuilderInstance,
      policyServiceMock,
      stateProviderMock,
      accountServiceMock,
      viewCacheServiceMock,
      restrictedItemTypesServiceMock,
      configService,
    );
  });

  return { service: service!, cachedSignal: seededCachedSignal };
}
