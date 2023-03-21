import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom, ReplaySubject, take } from "rxjs";

import { CollectionService } from "@bitwarden/common/abstractions/collection.service";
import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { OrganizationService } from "@bitwarden/common/abstractions/organization/organization.service.abstraction";
import { PolicyService } from "@bitwarden/common/abstractions/policy/policy.service.abstraction";
import { StateService } from "@bitwarden/common/abstractions/state.service";
import { PolicyType } from "@bitwarden/common/enums/policyType";
import { Organization } from "@bitwarden/common/models/domain/organization";
import { CollectionView } from "@bitwarden/common/models/view/collection.view";
import { Guid } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";

import { VaultFilterService } from "./vault-filter.service";

describe("vault filter service", () => {
  let vaultFilterService: VaultFilterService;

  let stateService: MockProxy<StateService>;
  let organizationService: MockProxy<OrganizationService>;
  let folderService: MockProxy<FolderService>;
  let cipherService: MockProxy<CipherService>;
  let collectionService: MockProxy<CollectionService>;
  let policyService: MockProxy<PolicyService>;
  let i18nService: MockProxy<I18nService>;
  let organizations: ReplaySubject<Organization[]>;
  let folderViews: ReplaySubject<FolderView[]>;

  beforeEach(() => {
    stateService = mock<StateService>();
    organizationService = mock<OrganizationService>();
    folderService = mock<FolderService>();
    cipherService = mock<CipherService>();
    collectionService = mock<CollectionService>();
    policyService = mock<PolicyService>();
    i18nService = mock<I18nService>();
    i18nService.collator = new Intl.Collator("en-US");

    organizations = new ReplaySubject<Organization[]>(1);
    folderViews = new ReplaySubject<FolderView[]>(1);

    organizationService.organizations$ = organizations;
    folderService.folderViews$ = folderViews;

    vaultFilterService = new VaultFilterService(
      stateService,
      organizationService,
      folderService,
      cipherService,
      collectionService,
      policyService,
      i18nService
    );
  });

  describe("collapsed filter nodes", () => {
    const nodes = new Set(["1", "2"]);
    it("updates observable when saving", (complete) => {
      vaultFilterService.collapsedFilterNodes$.pipe(take(1)).subscribe((value) => {
        if (value === nodes) {
          complete();
        }
      });

      vaultFilterService.setCollapsedFilterNodes(nodes);
    });

    it("loads from state on initialization", async () => {
      stateService.getCollapsedGroupings.mockResolvedValue(["1", "2"]);

      await expect(firstValueFrom(vaultFilterService.collapsedFilterNodes$)).resolves.toEqual(
        nodes
      );
    });
  });

  describe("organizations", () => {
    beforeEach(() => {
      const storedOrgs = [createOrganization("1", "org1"), createOrganization("2", "org2")];
      organizations.next(storedOrgs);
    });

    it("returns a nested tree", async () => {
      const tree = await firstValueFrom(vaultFilterService.organizationTree$);

      expect(tree.children.length).toBe(3);
      expect(tree.children.find((o) => o.node.name === "org1"));
      expect(tree.children.find((o) => o.node.name === "org2"));
    });

    it("hides My Vault if personal ownership policy is enabled", async () => {
      policyService.policyAppliesToUser
        .calledWith(PolicyType.PersonalOwnership)
        .mockResolvedValue(true);

      const tree = await firstValueFrom(vaultFilterService.organizationTree$);

      expect(tree.children.length).toBe(2);
      expect(!tree.children.find((o) => o.node.id === "MyVault"));
    });

    it("returns 1 organization and My Vault if single organization policy is enabled", async () => {
      policyService.policyAppliesToUser.calledWith(PolicyType.SingleOrg).mockResolvedValue(true);

      const tree = await firstValueFrom(vaultFilterService.organizationTree$);

      expect(tree.children.length).toBe(2);
      expect(tree.children.find((o) => o.node.name === "org1"));
      expect(tree.children.find((o) => o.node.id === "MyVault"));
    });

    it("returns 1 organization if both single organization and personal ownership policies are enabled", async () => {
      policyService.policyAppliesToUser.calledWith(PolicyType.SingleOrg).mockResolvedValue(true);
      policyService.policyAppliesToUser
        .calledWith(PolicyType.PersonalOwnership)
        .mockResolvedValue(true);

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
        cipherService.getAllDecrypted.mockResolvedValue(storedCiphers);

        const storedFolders = [
          createFolderView("folder test id", "test"),
          createFolderView("non matching folder id", "test2"),
        ];
        folderViews.next(storedFolders);

        await expect(firstValueFrom(vaultFilterService.filteredFolders$)).resolves.toEqual([
          createFolderView("folder test id", "test"),
        ]);
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
        collectionService.getAllDecrypted.mockResolvedValue(storedCollections);
        vaultFilterService.reloadCollections();

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
        collectionService.getAllDecrypted.mockResolvedValue(storedCollections);
        vaultFilterService.reloadCollections();

        const result = await firstValueFrom(vaultFilterService.collectionTree$);

        expect(result.children.map((c) => c.node.id)).toEqual(["id-1"]);
        expect(result.children[0].children.map((c) => c.node.id)).toEqual(["id-2", "id-3"]);
      });

      it("returns tree where non-existing collections are excluded from children", async () => {
        const storedCollections = [
          createCollectionView("id-1", "Collection 1", "org test id"),
          createCollectionView("id-3", "Collection 1/Collection 2/Collection 3", "org test id"),
        ];
        collectionService.getAllDecrypted.mockResolvedValue(storedCollections);
        vaultFilterService.reloadCollections();

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
        collectionService.getAllDecrypted.mockResolvedValue(storedCollections);
        vaultFilterService.reloadCollections();

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
        collectionService.getAllDecrypted.mockResolvedValue(storedCollections);
        vaultFilterService.reloadCollections();

        const result = await firstValueFrom(vaultFilterService.collectionTree$);

        const c1 = result.children[0];
        const c3 = c1.children[0];
        expect(c3.parent.node.id).toEqual("id-1");
      });
    });
  });

  function createOrganization(id: string, name: string) {
    const org = new Organization();
    org.id = id as Guid;
    org.name = name;
    org.identifier = name;
    return org;
  }

  function createCipherView(id: string, orgId: string, folderId: string) {
    const cipher = new CipherView();
    cipher.id = id as Guid;
    cipher.organizationId = orgId as Guid;
    cipher.folderId = folderId as Guid;
    return cipher;
  }

  function createFolderView(id: string, name: string): FolderView {
    const folder = new FolderView();
    folder.id = id as Guid;
    folder.name = name;
    return folder;
  }

  function createCollectionView(id: string, name: string, orgId: string): CollectionView {
    const collection = new CollectionView();
    collection.id = id as Guid;
    collection.name = name;
    collection.organizationId = orgId as Guid;
    return collection;
  }
});
