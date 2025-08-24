import {
  FakeAccountService,
  mockAccountServiceWith,
} from "@bitwarden/common/../spec/fake-account-service";
import { FakeSingleUserState } from "@bitwarden/common/../spec/fake-state";
import { FakeStateProvider } from "@bitwarden/common/../spec/fake-state-provider";
import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom, of, ReplaySubject } from "rxjs";

import {
  CollectionService,
  CollectionType,
  CollectionTypes,
  CollectionView,
} from "@bitwarden/admin-console/common";
import * as vaultFilterSvc from "@bitwarden/angular/vault/vault-filter/services/vault-filter.service";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { CollectionId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { COLLAPSED_GROUPINGS } from "@bitwarden/common/vault/services/key-state/collapsed-groupings.state";

import { VaultFilterService } from "./vault-filter.service";

jest.mock("@bitwarden/angular/vault/vault-filter/services/vault-filter.service", () => ({
  sortDefaultCollections: jest.fn(() => []),
}));

describe("vault filter service", () => {
  let vaultFilterService: VaultFilterService;

  let organizationService: MockProxy<OrganizationService>;
  let folderService: MockProxy<FolderService>;
  let cipherService: MockProxy<CipherService>;
  let policyService: MockProxy<PolicyService>;
  let i18nService: MockProxy<I18nService>;
  let collectionService: MockProxy<CollectionService>;
  let organizations: ReplaySubject<Organization[]>;
  let folderViews: ReplaySubject<FolderView[]>;
  let collectionViews: ReplaySubject<CollectionView[]>;
  let cipherViews: ReplaySubject<CipherView[]>;
  let organizationDataOwnershipPolicy: ReplaySubject<boolean>;
  let singleOrgPolicy: ReplaySubject<boolean>;
  let stateProvider: FakeStateProvider;
  let configService: MockProxy<ConfigService>;

  const mockUserId = Utils.newGuid() as UserId;
  let accountService: FakeAccountService;
  let collapsedGroupingsState: FakeSingleUserState<string[]>;

  beforeEach(() => {
    organizationService = mock<OrganizationService>();
    folderService = mock<FolderService>();
    cipherService = mock<CipherService>();
    policyService = mock<PolicyService>();
    i18nService = mock<I18nService>();
    accountService = mockAccountServiceWith(mockUserId);
    stateProvider = new FakeStateProvider(accountService);
    i18nService.collator = new Intl.Collator("en-US");
    collectionService = mock<CollectionService>();
    configService = mock<ConfigService>();

    organizations = new ReplaySubject<Organization[]>(1);
    folderViews = new ReplaySubject<FolderView[]>(1);
    collectionViews = new ReplaySubject<CollectionView[]>(1);
    cipherViews = new ReplaySubject<CipherView[]>(1);
    organizationDataOwnershipPolicy = new ReplaySubject<boolean>(1);
    singleOrgPolicy = new ReplaySubject<boolean>(1);

    configService.getFeatureFlag$.mockReturnValue(of(true));
    organizationService.memberOrganizations$.mockReturnValue(organizations);
    folderService.folderViews$.mockReturnValue(folderViews);
    collectionService.decryptedCollections$.mockReturnValue(collectionViews);
    policyService.policyAppliesToUser$
      .calledWith(PolicyType.OrganizationDataOwnership, mockUserId)
      .mockReturnValue(organizationDataOwnershipPolicy);
    policyService.policyAppliesToUser$
      .calledWith(PolicyType.SingleOrg, mockUserId)
      .mockReturnValue(singleOrgPolicy);
    cipherService.cipherListViews$.mockReturnValue(cipherViews);

    vaultFilterService = new VaultFilterService(
      organizationService,
      folderService,
      cipherService,
      policyService,
      i18nService,
      stateProvider,
      collectionService,
      accountService,
      configService,
    );
    collapsedGroupingsState = stateProvider.singleUser.getFake(mockUserId, COLLAPSED_GROUPINGS);
    organizations.next([]);
  });

  describe("collapsed filter nodes", () => {
    const nodes = new Set(["1", "2"]);

    it("should update the collapsedFilterNodes$", async () => {
      await vaultFilterService.setCollapsedFilterNodes(nodes, mockUserId);

      const collapsedGroupingsState = stateProvider.singleUser.getFake(
        mockUserId,
        COLLAPSED_GROUPINGS,
      );
      expect(await firstValueFrom(collapsedGroupingsState.state$)).toEqual(Array.from(nodes));
      expect(collapsedGroupingsState.nextMock).toHaveBeenCalledWith(Array.from(nodes));
    });

    it("loads from state on initialization", async () => {
      collapsedGroupingsState.nextState(["1", "2"]);

      await expect(firstValueFrom(vaultFilterService.collapsedFilterNodes$)).resolves.toEqual(
        nodes,
      );
    });
  });

  describe("organizations", () => {
    beforeEach(() => {
      const storedOrgs = [createOrganization("1", "org1"), createOrganization("2", "org2")];
      organizations.next(storedOrgs);
      organizationDataOwnershipPolicy.next(false);
      singleOrgPolicy.next(false);
    });

    it("returns a nested tree", async () => {
      const tree = await firstValueFrom(vaultFilterService.organizationTree$);

      expect(tree.children.length).toBe(3);
      expect(tree.children.find((o) => o.node.name === "org1"));
      expect(tree.children.find((o) => o.node.name === "org2"));
    });

    it("hides My Vault if organization data ownership policy is enabled", async () => {
      organizationDataOwnershipPolicy.next(true);

      const tree = await firstValueFrom(vaultFilterService.organizationTree$);

      expect(tree.children.length).toBe(2);
      expect(!tree.children.find((o) => o.node.id === "MyVault"));
    });

    it("returns 1 organization and My Vault if single organization policy is enabled", async () => {
      singleOrgPolicy.next(true);

      const tree = await firstValueFrom(vaultFilterService.organizationTree$);

      expect(tree.children.length).toBe(2);
      expect(tree.children.find((o) => o.node.name === "org1"));
      expect(tree.children.find((o) => o.node.id === "MyVault"));
    });

    it("returns 1 organization if both single organization and organization data ownership policies are enabled", async () => {
      singleOrgPolicy.next(true);
      organizationDataOwnershipPolicy.next(true);

      const tree = await firstValueFrom(vaultFilterService.organizationTree$);

      expect(tree.children.length).toBe(1);
      expect(tree.children.find((o) => o.node.name === "org1"));
    });
  });

  describe("folders", () => {
    describe("filtered folders with organization", () => {
      beforeEach(() => {
        // Org must be updated before folderService else the subscription uses the null org default value
        vaultFilterService.setOrganizationFilter(createOrganization("org test id", "Test Org"));
      });
      it("returns folders filtered by current organization", async () => {
        const storedCiphers = [
          createCipherView("1", "org test id", "folder test id"),
          createCipherView("2", "non matching org id", "non matching folder id"),
        ];
        cipherViews.next(storedCiphers);

        const storedFolders = [
          createFolderView("folder test id", "test"),
          createFolderView("non matching folder id", "test2"),
        ];
        folderViews.next(storedFolders);

        await expect(firstValueFrom(vaultFilterService.filteredFolders$)).resolves.toEqual([
          createFolderView("folder test id", "test"),
        ]);
      });

      it("returns current organization", () => {
        vaultFilterService.getOrganizationFilter().subscribe((org) => {
          expect(org.id).toEqual("org test id");
          expect(org.identifier).toEqual("Test Org");
        });
      });
    });

    describe("folder tree", () => {
      it("returns a nested tree", async () => {
        const storedFolders = [
          createFolderView("Folder 1 Id", "Folder 1"),
          createFolderView("Folder 2 Id", "Folder 1/Folder 2"),
          createFolderView("Folder 3 Id", "Folder 1/Folder 3"),
        ];
        folderViews.next(storedFolders);
        cipherViews.next([]);

        const result = await firstValueFrom(vaultFilterService.folderTree$);

        expect(result.children[0].node.id === "Folder 1 Id");
        expect(result.children[0].children.find((c) => c.node.id === "Folder 2 Id"));
        expect(result.children[0].children.find((c) => c.node.id === "Folder 3 Id"));
      }, 10000);
    });
  });

  describe("collections", () => {
    describe("filtered collections", () => {
      it("returns collections filtered by current organization", async () => {
        vaultFilterService.setOrganizationFilter(createOrganization("org test id", "Test Org"));

        const storedCollections = [
          createCollectionView("1", "collection 1", "org test id"),
          createCollectionView("2", "collection 2", "non matching org id"),
        ];
        collectionViews.next(storedCollections);

        await expect(firstValueFrom(vaultFilterService.filteredCollections$)).resolves.toEqual([
          createCollectionView("1", "collection 1", "org test id"),
        ]);
      });
    });

    describe("collection tree", () => {
      it("returns tree with children", async () => {
        const storedCollections = [
          createCollectionView("id-1", "Collection 1", "org test id"),
          createCollectionView("id-2", "Collection 1/Collection 2", "org test id"),
          createCollectionView("id-3", "Collection 1/Collection 3", "org test id"),
        ];
        collectionViews.next(storedCollections);

        const result = await firstValueFrom(vaultFilterService.collectionTree$);

        expect(result.children.map((c) => c.node.id)).toEqual(["id-1"]);
        expect(result.children[0].children.map((c) => c.node.id)).toEqual(["id-2", "id-3"]);
      });

      it("returns tree where non-existing collections are excluded from children", async () => {
        const storedCollections = [
          createCollectionView("id-1", "Collection 1", "org test id"),
          createCollectionView("id-3", "Collection 1/Collection 2/Collection 3", "org test id"),
        ];
        collectionViews.next(storedCollections);

        const result = await firstValueFrom(vaultFilterService.collectionTree$);

        expect(result.children.map((c) => c.node.id)).toEqual(["id-1"]);
        expect(result.children[0].children.map((c) => c.node.id)).toEqual(["id-3"]);
        expect(result.children[0].children[0].node.name).toBe("Collection 2/Collection 3");
      });

      it("returns tree with parents", async () => {
        const storedCollections = [
          createCollectionView("id-1", "Collection 1", "org test id"),
          createCollectionView("id-2", "Collection 1/Collection 2", "org test id"),
          createCollectionView("id-3", "Collection 1/Collection 2/Collection 3", "org test id"),
          createCollectionView("id-4", "Collection 1/Collection 4", "org test id"),
        ];
        collectionViews.next(storedCollections);

        const result = await firstValueFrom(vaultFilterService.collectionTree$);

        const c1 = result.children[0];
        const c2 = c1.children[0];
        const c3 = c2.children[0];
        const c4 = c1.children[1];
        expect(c2.parent.node.id).toEqual("id-1");
        expect(c3.parent.node.id).toEqual("id-2");
        expect(c4.parent.node.id).toEqual("id-1");
      });

      it("returns tree where non-existing collections are excluded from parents", async () => {
        const storedCollections = [
          createCollectionView("id-1", "Collection 1", "org test id"),
          createCollectionView("id-3", "Collection 1/Collection 2/Collection 3", "org test id"),
        ];
        collectionViews.next(storedCollections);

        const result = await firstValueFrom(vaultFilterService.collectionTree$);

        const c1 = result.children[0];
        const c3 = c1.children[0];
        expect(c3.parent.node.id).toEqual("id-1");
      });

      it.only("calls sortDefaultCollections with the correct args", async () => {
        const storedOrgs = [
          createOrganization("id-defaultOrg1", "org1"),
          createOrganization("id-defaultOrg2", "org2"),
        ];
        organizations.next(storedOrgs);

        const storedCollections = [
          createCollectionView("id-2", "Collection 2", "org test id"),
          createCollectionView("id-1", "Collection 1", "org test id"),
          createCollectionView(
            "id-3",
            "Default User Collection - Org 2",
            "id-defaultOrg2",
            CollectionTypes.DefaultUserCollection,
          ),
          createCollectionView(
            "id-4",
            "Default User Collection - Org 1",
            "id-defaultOrg1",
            CollectionTypes.DefaultUserCollection,
          ),
        ];
        collectionViews.next(storedCollections);

        await firstValueFrom(vaultFilterService.collectionTree$);

        expect(vaultFilterSvc.sortDefaultCollections).toHaveBeenCalledWith(
          storedCollections,
          storedOrgs,
          i18nService.collator,
        );
      });
    });
  });

  function createOrganization(id: string, name: string) {
    const org = new Organization();
    org.id = id;
    org.name = name;
    org.identifier = name;
    org.isMember = true;
    return org;
  }

  function createCipherView(id: string, orgId: string, folderId: string) {
    const cipher = new CipherView();
    cipher.id = id;
    cipher.organizationId = orgId;
    cipher.folderId = folderId;
    return cipher;
  }

  function createFolderView(id: string, name: string): FolderView {
    const folder = new FolderView();
    folder.id = id;
    folder.name = name;
    return folder;
  }

  function createCollectionView(
    id: string,
    name: string,
    orgId: string,
    type?: CollectionType,
  ): CollectionView {
    const collection = new CollectionView({
      id: id as CollectionId,
      name,
      organizationId: orgId as OrganizationId,
    });

    if (type) {
      collection.type = type;
    }

    return collection;
  }
});
