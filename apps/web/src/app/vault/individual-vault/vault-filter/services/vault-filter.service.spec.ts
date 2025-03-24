import {
  FakeAccountService,
  mockAccountServiceWith,
} from "@bitwarden/common/../spec/fake-account-service";
import { FakeActiveUserState } from "@bitwarden/common/../spec/fake-state";
import { FakeStateProvider } from "@bitwarden/common/../spec/fake-state-provider";
import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom, ReplaySubject } from "rxjs";

import { CollectionService, CollectionView } from "@bitwarden/admin-console/common";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyType } from "@bitwarden/common/admin-console/enums";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { COLLAPSED_GROUPINGS } from "@bitwarden/common/vault/services/key-state/collapsed-groupings.state";

import { VaultFilterService } from "./vault-filter.service";

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
  let personalOwnershipPolicy: ReplaySubject<boolean>;
  let singleOrgPolicy: ReplaySubject<boolean>;
  let stateProvider: FakeStateProvider;

  const mockUserId = Utils.newGuid() as UserId;
  let accountService: FakeAccountService;
  let collapsedGroupingsState: FakeActiveUserState<string[]>;

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

    organizations = new ReplaySubject<Organization[]>(1);
    folderViews = new ReplaySubject<FolderView[]>(1);
    collectionViews = new ReplaySubject<CollectionView[]>(1);
    cipherViews = new ReplaySubject<CipherView[]>(1);
    personalOwnershipPolicy = new ReplaySubject<boolean>(1);
    singleOrgPolicy = new ReplaySubject<boolean>(1);

    organizationService.memberOrganizations$.mockReturnValue(organizations);
    folderService.folderViews$.mockReturnValue(folderViews);
    collectionService.decryptedCollections$ = collectionViews;
    policyService.policyAppliesToActiveUser$
      .calledWith(PolicyType.PersonalOwnership)
      .mockReturnValue(personalOwnershipPolicy);
    policyService.policyAppliesToActiveUser$
      .calledWith(PolicyType.SingleOrg)
      .mockReturnValue(singleOrgPolicy);
    cipherService.cipherViews$.mockReturnValue(cipherViews);

    vaultFilterService = new VaultFilterService(
      organizationService,
      folderService,
      cipherService,
      policyService,
      i18nService,
      stateProvider,
      collectionService,
      accountService,
    );
    collapsedGroupingsState = stateProvider.activeUser.getFake(COLLAPSED_GROUPINGS);
  });

  describe("collapsed filter nodes", () => {
    const nodes = new Set(["1", "2"]);

    it("should update the collapsedFilterNodes$", async () => {
      await vaultFilterService.setCollapsedFilterNodes(nodes);

      const collapsedGroupingsState = stateProvider.activeUser.getFake(COLLAPSED_GROUPINGS);
      expect(await firstValueFrom(collapsedGroupingsState.state$)).toEqual(Array.from(nodes));
      expect(collapsedGroupingsState.nextMock).toHaveBeenCalledWith([
        mockUserId,
        Array.from(nodes),
      ]);
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
      personalOwnershipPolicy.next(false);
      singleOrgPolicy.next(false);
    });

    it("returns a nested tree", async () => {
      const tree = await firstValueFrom(vaultFilterService.organizationTree$);

      expect(tree.children.length).toBe(3);
      expect(tree.children.find((o) => o.node.name === "org1"));
      expect(tree.children.find((o) => o.node.name === "org2"));
    });

    it("hides My Vault if personal ownership policy is enabled", async () => {
      personalOwnershipPolicy.next(true);

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

    it("returns 1 organization if both single organization and personal ownership policies are enabled", async () => {
      singleOrgPolicy.next(true);
      personalOwnershipPolicy.next(true);

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

  function createCollectionView(id: string, name: string, orgId: string): CollectionView {
    const collection = new CollectionView();
    collection.id = id;
    collection.name = name;
    collection.organizationId = orgId;
    return collection;
  }
});
