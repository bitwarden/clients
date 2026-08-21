import { Injector, WritableSignal, runInInjectionContext, signal } from "@angular/core";
import { TestBed, discardPeriodicTasks, fakeAsync, tick } from "@angular/core/testing";
import { FormBuilder } from "@angular/forms";
import { BehaviorSubject, firstValueFrom, skipWhile } from "rxjs";

import { CollectionService } from "@bitwarden/admin-console/common";
import { ViewCacheService } from "@bitwarden/angular/platform/view-cache";
import * as vaultFilterSvc from "@bitwarden/angular/vault/vault-filter/services/vault-filter.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { asUuid } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
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
  NO_FOLDER_COUNT_KEY,
  PopupListFilter,
  VaultPopupListFiltersService,
} from "./vault-popup-list-filters.service";

const configService = {
  getFeatureFlag$: jest.fn(() => new BehaviorSubject<boolean>(false)),
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

    it("excludes BankAccount cipher type when the feature flag is disabled", (done) => {
      service.cipherTypes$.subscribe((cipherTypes) => {
        expect(cipherTypes.map((c) => c.value)).not.toContain(CipherType.BankAccount);
        done();
      });
    });

    it("includes BankAccount cipher type when the feature flag is enabled", (done) => {
      (configService.getFeatureFlag$ as jest.Mock).mockReturnValueOnce(new BehaviorSubject(true));
      const { service: flagEnabledService } = createSeededVaultPopupListFiltersService(
        [],
        [],
        [],
        {},
      );

      flagEnabledService.cipherTypes$.subscribe((cipherTypes) => {
        expect(cipherTypes.map((c) => c.value)).toEqual([
          CipherType.Login,
          CipherType.Card,
          CipherType.BankAccount,
          CipherType.Identity,
          CipherType.DriversLicense,
          CipherType.Passport,
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
        folder: [{ id: "folder11" } as FolderView],
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
            "bwi-exclamation-triangle",
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
      folderViews$.next([{ id: "", name: "No Folder" }]);

      service.folders$.subscribe((folders) => {
        expect(folders).toEqual([]);
        done();
      });
    });

    it('moves "No Folders" to the top of the list', (done) => {
      folderViews$.next([
        { id: "", name: "No Folder" },
        { id: "2345", name: "Folder 2" },
        { id: "1234", name: "Folder 1" },
      ]);

      service.folders$.subscribe((folders) => {
        expect(folders.map((f) => f.label)).toEqual(["noFoldersLabel", "Folder 1", "Folder 2"]);
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
      {
        type: CipherType.Card,
        collectionIds: [asUuid("cbcae898-9f9a-48eb-863e-edf92e3ad7e0")],
        organizationId: "8978" as any,
      },
      {
        type: CipherType.Identity,
        collectionIds: [],
        folderId: "5432" as any,
        organizationId: null,
      },
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
      const collection = { id: "cbcae898-9f9a-48eb-863e-edf92e3ad7e0" } as CollectionView;

      service.filterFunction$.subscribe((filterFunction) => {
        expect(filterFunction(ciphers)).toEqual([ciphers[1]]);
        done();
      });

      service.filterForm.patchValue({ collection: [collection] });
    });

    it("filters by folder", (done) => {
      const folder = { id: "5432" } as FolderView;

      service.filterFunction$.subscribe((filterFunction) => {
        expect(filterFunction(ciphers)).toEqual([ciphers[2]]);
        done();
      });

      service.filterForm.patchValue({ folder: [folder] });
    });

    /**
     * Collections and folders filter to a set: selections within a filter are OR'd, and the
     * filters are still AND'd against each other.
     */
    describe("multi-select filters", () => {
      /**
       * `filters$` replays the form value captured at construction, so a fresh subscription always
       * sees the unfiltered value — applying while subscribed is what puts the new one through.
       */
      const applyFilters = (filters: Partial<PopupListFilter>) => {
        let filterFunction!: (ciphers: PopupCipherViewLike[]) => PopupCipherViewLike[];
        const subscription = service.filterFunction$.subscribe((fn) => (filterFunction = fn));
        service.filterForm.patchValue(filters);
        subscription.unsubscribe();
        return filterFunction;
      };

      const multiCiphers = [
        {
          type: CipherType.Login,
          collectionIds: [],
          folderId: "work" as any,
          organizationId: null,
        },
        {
          type: CipherType.Login,
          collectionIds: [],
          folderId: "personal" as any,
          organizationId: null,
        },
        {
          type: CipherType.Card,
          collectionIds: [],
          folderId: "archive" as any,
          organizationId: null,
        },
        { type: CipherType.Login, collectionIds: [], organizationId: null },
      ] as CipherView[];

      it("matches items in any of the selected folders", () => {
        const filterFunction = applyFilters({
          folder: [{ id: "work" } as FolderView, { id: "personal" } as FolderView],
        });

        expect(filterFunction(multiCiphers)).toEqual([multiCiphers[0], multiCiphers[1]]);
      });

      it('matches folderless items alongside a named folder when "no folder" is selected', () => {
        const filterFunction = applyFilters({
          // "Items with no folder" carries a falsy id rather than one of its own.
          folder: [{ id: "" } as FolderView, { id: "work" } as FolderView],
        });

        expect(filterFunction(multiCiphers)).toEqual([multiCiphers[0], multiCiphers[3]]);
      });

      it("matches items in any of the selected collections", () => {
        const engineering = asUuid("cbcae898-9f9a-48eb-863e-edf92e3ad7e0");
        const marketing = asUuid("dbcae898-9f9a-48eb-863e-edf92e3ad7e1");
        const collectionCiphers = [
          { type: CipherType.Login, collectionIds: [engineering], organizationId: null },
          { type: CipherType.Login, collectionIds: [marketing], organizationId: null },
          { type: CipherType.Login, collectionIds: [], organizationId: null },
        ] as CipherView[];

        const filterFunction = applyFilters({
          collection: [{ id: engineering } as CollectionView, { id: marketing } as CollectionView],
        });

        expect(filterFunction(collectionCiphers)).toEqual([
          collectionCiphers[0],
          collectionCiphers[1],
        ]);
      });

      it("still narrows across filters", () => {
        const filterFunction = applyFilters({
          folder: [{ id: "work" } as FolderView, { id: "archive" } as FolderView],
          cipherType: CipherType.Card,
        });

        expect(filterFunction(multiCiphers)).toEqual([multiCiphers[2]]);
      });

      it("leaves the list unnarrowed when a filter is emptied", () => {
        applyFilters({ folder: [{ id: "work" } as FolderView] });
        const filterFunction = applyFilters({ folder: [] });

        expect(filterFunction(multiCiphers)).toEqual(multiCiphers);
      });
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

  /**
   * Changing the organization filter narrows which collections and folders are offered, so
   * selections outside the new organization are dropped and the rest stay applied.
   */
  describe("organization change", () => {
    it("drops only the collections outside the new organization", () => {
      const kept = { id: "col-1", organizationId: "org-1" } as CollectionView;
      const dropped = { id: "col-2", organizationId: "org-2" } as CollectionView;
      service.filterForm.controls.collection.setValue([kept, dropped]);

      service.filterForm.controls.organization.setValue({ id: "org-1" } as Organization);

      expect(service.filterForm.value.collection).toEqual([kept]);
    });

    it("keeps the folders the new organization has items in", () => {
      cipherListViews$.next({
        "1": { id: "1", organizationId: "org-1", folderId: "shared" },
        "2": { id: "2", organizationId: null, folderId: "personal" },
      } as any);
      // Folders belong to an organization only by way of its ciphers, read from the snapshot
      // `folders$` maintains.
      const subscription = service.folders$.subscribe();

      const kept = { id: "shared" } as FolderView;
      const dropped = { id: "personal" } as FolderView;
      service.filterForm.controls.folder.setValue([kept, dropped]);

      service.filterForm.controls.organization.setValue({ id: "org-1" } as Organization);

      expect(service.filterForm.value.folder).toEqual([kept]);
      subscription.unsubscribe();
    });

    /**
     * The option list drops "Items with no folder" when the new organization has no folderless
     * items, but the filter itself is left alone.
     */
    it('leaves an "Items with no folder" selection applied', () => {
      cipherListViews$.next({
        "1": { id: "1", organizationId: "org-1", folderId: "shared" },
      } as any);
      const subscription = service.folders$.subscribe();

      const noFolder = { id: "" } as FolderView;
      service.filterForm.controls.folder.setValue([noFolder]);

      service.filterForm.controls.organization.setValue({ id: "org-1" } as Organization);

      expect(service.filterForm.value.folder).toEqual([noFolder]);
      subscription.unsubscribe();
    });

    it("leaves every folder applied when My vault is selected", () => {
      const folders = [{ id: "shared" } as FolderView, { id: "personal" } as FolderView];
      service.filterForm.controls.folder.setValue(folders);

      service.filterForm.controls.organization.setValue({ id: MY_VAULT_ID } as Organization);

      expect(service.filterForm.value.folder).toEqual(folders);
    });
  });

  describe("filterOptionCounts$", () => {
    const countedCiphers = [
      { id: "1", type: CipherType.Login, collectionIds: [], organizationId: null },
      {
        id: "2",
        type: CipherType.Login,
        collectionIds: [],
        folderId: "folder-a",
        organizationId: null,
      },
      {
        id: "3",
        type: CipherType.Card,
        collectionIds: [asUuid("cbcae898-9f9a-48eb-863e-edf92e3ad7e0")],
        organizationId: "org-1",
      },
      {
        id: "4",
        type: CipherType.Identity,
        collectionIds: [asUuid("cbcae898-9f9a-48eb-863e-edf92e3ad7e0")],
        folderId: "folder-a",
        organizationId: "org-1",
      },
    ] as unknown as CipherView[];

    /**
     * The latest counts for a set of ciphers. `cipherListViews$` is shared across the suite and
     * `filterOptionCounts$` replays, so a bare `subscribe` would see the previous test's emission.
     */
    const countsFor = async (ciphers: CipherView[]) => {
      cipherListViews$.next({ ...ciphers });
      return await firstValueFrom(service.filterOptionCounts$);
    };

    it("counts the items belonging to each cipher type", async () => {
      const counts = await countsFor(countedCiphers);

      expect(counts.cipherType.get(CipherType.Login)).toBe(2);
      expect(counts.cipherType.get(CipherType.Card)).toBe(1);
      expect(counts.cipherType.get(CipherType.Identity)).toBe(1);
    });

    it("counts organization-less ciphers under My vault", async () => {
      const counts = await countsFor(countedCiphers);

      expect(counts.organization.get(MY_VAULT_ID)).toBe(2);
      expect(counts.organization.get("org-1")).toBe(2);
    });

    it("counts a cipher toward every collection it belongs to", async () => {
      const sharedByTwo = {
        id: "5",
        type: CipherType.Login,
        collectionIds: [
          asUuid("cbcae898-9f9a-48eb-863e-edf92e3ad7e0"),
          asUuid("dbcae898-9f9a-48eb-863e-edf92e3ad7e1"),
        ],
        organizationId: "org-1",
      } as unknown as CipherView;

      const counts = await countsFor([...countedCiphers, sharedByTwo]);

      expect(counts.collection.get("cbcae898-9f9a-48eb-863e-edf92e3ad7e0")).toBe(3);
      expect(counts.collection.get("dbcae898-9f9a-48eb-863e-edf92e3ad7e1")).toBe(1);
    });

    it("counts folderless ciphers under the no-folder key", async () => {
      const counts = await countsFor(countedCiphers);

      expect(counts.folder.get("folder-a")).toBe(2);
      expect(counts.folder.get(NO_FOLDER_COUNT_KEY)).toBe(2);
    });

    it("excludes deleted ciphers from every count", async () => {
      // `CipherViewLikeUtils.isDeleted` reads `isDeleted` on a `CipherView`, which these are.
      const deleted = {
        id: "6",
        type: CipherType.Login,
        collectionIds: [],
        organizationId: null,
        isDeleted: true,
      } as unknown as CipherView;

      const counts = await countsFor([...countedCiphers, deleted]);

      expect(counts.cipherType.get(CipherType.Login)).toBe(2);
    });

    it("excludes archived ciphers from every count", async () => {
      const archived = {
        id: "6",
        type: CipherType.Login,
        collectionIds: [],
        organizationId: null,
        isArchived: true,
      } as unknown as CipherView;

      const counts = await countsFor([...countedCiphers, archived]);

      expect(counts.cipherType.get(CipherType.Login)).toBe(2);
    });

    it("excludes restricted ciphers from every count", async () => {
      const restricted = {
        id: "6",
        type: CipherType.Login,
        collectionIds: [],
        organizationId: null,
      } as unknown as CipherView;

      restrictedItemTypesService.isCipherRestricted.mockImplementation(
        (cipher: CipherView) => cipher === restricted,
      );

      const counts = await countsFor([...countedCiphers, restricted]);

      expect(counts.cipherType.get(CipherType.Login)).toBe(2);

      restrictedItemTypesService.isCipherRestricted.mockReturnValue(false);
    });

    it("counts the whole vault regardless of which filters are applied", async () => {
      service.filterForm.patchValue({ organization: { id: "org-1" } as Organization });

      const counts = await countsFor(countedCiphers);

      // Absolute, not faceted: the org filter narrows the list but leaves every count alone.
      expect(counts.cipherType.get(CipherType.Login)).toBe(2);
      expect(counts.cipherType.get(CipherType.Card)).toBe(1);
      expect(counts.cipherType.get(CipherType.Identity)).toBe(1);
      expect(counts.organization.get(MY_VAULT_ID)).toBe(2);
      expect(counts.organization.get("org-1")).toBe(2);
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
        collectionIds: ["test-collection-id"],
        folderIds: ["test-folder-id"],
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
        collection: [
          {
            id: "test-collection-id",
            organizationId: MY_VAULT_ID,
            name: "Test collection",
          },
        ],
        folder: [{ id: "test-folder-id", name: "Test Folder" }],
        cipherType: CipherType.Login,
      });
      discardPeriodicTasks();
    }));

    /**
     * The cache is written on every filter change and read on the next popup open, so an entry
     * predating multi-select outlives the update — dropping it would clear the user's filters.
     */
    it("initializes form from the pre-multi-select cached state", fakeAsync(() => {
      const cachedState: CachedFilterState = {
        collectionId: "test-collection-id",
        folderId: "test-folder-id",
      };

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
        [{ id: MY_VAULT_ID, name: "Test Org" } as Organization],
        seededCollections,
        seededFolderViews,
        cachedState,
      );

      tick();

      expect(service.filterForm.value.collection).toEqual(seededCollections);
      expect(service.filterForm.value.folder).toEqual(seededFolderViews);
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
        collection: [testCollection],
        folder: [testFolder],
        cipherType: CipherType.Card,
      });

      tick(300);

      // force another emission by patching with the same value again. workaround for debounce times
      service.filterForm.patchValue({
        organization: testOrg,
        collection: [testCollection],
        folder: [testFolder],
        cipherType: CipherType.Card,
      });

      tick(300);

      expect(cachedSignal()).toEqual({
        organizationId: "test-org-id",
        collectionIds: ["test-collection-id"],
        folderIds: ["test-folder-id"],
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
      seededCollections$.value.map((c): TreeNode<CollectionView> => ({
        children: [],
        node: c,
        parent: null as any,
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
