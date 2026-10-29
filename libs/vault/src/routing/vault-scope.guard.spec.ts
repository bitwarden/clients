import { TestBed } from "@angular/core/testing";
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  convertToParamMap,
} from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { CollectionService } from "@bitwarden/admin-console/common";
import { Collection } from "@bitwarden/common/admin-console/models/collections";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { CollectionId, OrganizationId, UserId } from "@bitwarden/common/types/guid";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { Folder } from "@bitwarden/common/vault/models/domain/folder";
// eslint-disable-next-line no-restricted-imports
import { EncString } from "@bitwarden/legacy-crypto";

import {
  VaultNavItemType,
  VaultNavItemViewModel,
  VaultsNavViewModel,
} from "../models/vault-nav-view-model";
import { ARCHIVE_ROUTE, MY_ITEMS_ROUTE, MY_VAULT_ROUTE, TRASH_ROUTE } from "../models/vault-scope";
import { VaultNavService } from "../services/vault-nav.service";

import { MY_ITEMS_ROUTE_DATA } from "./scoped-collection";
import { vaultScopeGuard } from "./vault-scope.guard";

describe("vaultScopeGuard", () => {
  const userId = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d" as UserId;
  const organizationId = "1b2c3d4e-5f60-4a1b-8c2d-3e4f5a6b7c8d" as OrganizationId;
  const otherOrganizationId = "9a8b7c6d-5e4f-4a3b-8c2d-1e2f3a4b5c6d" as OrganizationId;

  const state = mock<RouterStateSnapshot>();
  const allItemsUrlTree = mock<UrlTree>();
  const organizationVaultUrlTree = mock<UrlTree>();

  let router: MockProxy<Router>;

  const viewModel$ = new BehaviorSubject<VaultsNavViewModel>({
    vaults: [],
    organizationDataOwnership: false,
  });
  const vaultNavService = mock<VaultNavService>();

  const personalVault: VaultNavItemViewModel = {
    id: userId,
    label: "My vault",
    color: "coral",
    icon: "bwi-user",
    type: VaultNavItemType.Personal,
    enabled: true,
  };

  const organizationVault: VaultNavItemViewModel = {
    id: organizationId,
    label: "Acme corporation",
    icon: "bwi-business",
    type: VaultNavItemType.Organization,
    enabled: true,
  };

  /** The same organization under data ownership, which gives each member a "My items" collection. */
  const dataOwnershipVault: VaultNavItemViewModel = {
    ...organizationVault,
    defaultUserCollectionId: "5e6f7a8b-9c1d-4e2f-8a3b-4c5d6e7f8a9b" as CollectionId,
  };

  const navViewModel = (
    vaults: VaultNavItemViewModel[],
    organizationDataOwnership = false,
  ): VaultsNavViewModel => ({ vaults, organizationDataOwnership });

  const accountService = mock<AccountService>();
  const collectionService = mock<CollectionService>();
  const folderService = mock<FolderService>();
  const syncService = mock<SyncService>();

  /**
   * A shared folder of the organization the account is a member of, as the user holds it. The name
   * stays encrypted: the guard reads collections without decrypting them, so an id and an
   * organization are all it ever looks at.
   */
  const collection = (id: string, orgId: OrganizationId = organizationId) =>
    new Collection({
      id: id as CollectionId,
      organizationId: orgId,
      name: new EncString("2.abc123|def456==|ghi789=="),
    });

  /**
   * A vault route's snapshot, carrying the collection segment wherever the real route carries it:
   * the "My items" route declares it in its data, a shared folder drill-in takes it as a param —
   * see `scopedCollectionSegment`.
   *
   * A plain object rather than a `mock`, whose proxy answers a read of an absent key with an
   * auto-stubbed function — so a route with no data would look like one naming a collection.
   */
  const makeRoute = (vaultId?: string, collectionId?: string): ActivatedRouteSnapshot => {
    const inData = collectionId === MY_ITEMS_ROUTE;

    return {
      paramMap: convertToParamMap({
        ...(vaultId == null ? {} : { vaultId }),
        ...(collectionId == null || inData ? {} : { collectionId }),
      }),
      data: inData ? MY_ITEMS_ROUTE_DATA : {},
    } as ActivatedRouteSnapshot;
  };

  const runGuard = (vaultId?: string, collectionId?: string) =>
    TestBed.runInInjectionContext(() => vaultScopeGuard(makeRoute(vaultId, collectionId), state));

  beforeEach(() => {
    router = mock<Router>();
    // The organization vault is the only redirect that carries a segment beyond "/vault".
    router.createUrlTree.mockImplementation((commands) =>
      (commands as unknown[]).length > 1 ? organizationVaultUrlTree : allItemsUrlTree,
    );

    viewModel$.next(navViewModel([personalVault, organizationVault]));
    vaultNavService.viewModel$.mockReturnValue(viewModel$);

    accountService.activeAccount$ = of({ id: userId } as Account);
    collectionService.encryptedCollections$.mockReturnValue(of([]));
    folderService.folders$.mockReturnValue(of([]));
    syncService.lastSync$.mockReturnValue(of(new Date()));
    syncService.fullSync.mockClear();

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: router },
        { provide: VaultNavService, useValue: vaultNavService },
        { provide: AccountService, useValue: accountService },
        { provide: CollectionService, useValue: collectionService },
        { provide: FolderService, useValue: folderService },
        { provide: SyncService, useValue: syncService },
      ],
    });
  });

  it("allows the personal vault when the account has another vault to distinguish it from", async () => {
    await expect(runGuard(MY_VAULT_ROUTE)).resolves.toBe(true);
  });

  it("redirects the personal vault to All items when it is the account's only vault", async () => {
    viewModel$.next(navViewModel([personalVault]));

    await expect(runGuard(MY_VAULT_ROUTE)).resolves.toBe(allItemsUrlTree);
    expect(router.createUrlTree).toHaveBeenCalledWith(["/vault"]);
  });

  it("allows the personal vault under organization data ownership, which offers no entry for it", async () => {
    viewModel$.next(navViewModel([organizationVault], true));

    await expect(runGuard(MY_VAULT_ROUTE)).resolves.toBe(true);
  });

  it("allows trash and the archive, which need no membership check", async () => {
    await expect(runGuard(TRASH_ROUTE)).resolves.toBe(true);
    await expect(runGuard(ARCHIVE_ROUTE)).resolves.toBe(true);
  });

  it("allows an organization the user is a member of", async () => {
    await expect(runGuard(organizationId)).resolves.toBe(true);
  });

  it("redirects to All items for an organization the user is not a member of", async () => {
    await expect(runGuard(otherOrganizationId)).resolves.toBe(allItemsUrlTree);
    expect(router.createUrlTree).toHaveBeenCalledWith(["/vault"]);
  });

  it("does not mistake the personal vault's own id for an organization", async () => {
    await expect(runGuard(userId)).resolves.toBe(allItemsUrlTree);
    expect(router.createUrlTree).toHaveBeenCalledWith(["/vault"]);
  });

  it("redirects to All items for a segment that names no destination", async () => {
    await expect(runGuard("acme-corp")).resolves.toBe(allItemsUrlTree);
    expect(router.createUrlTree).toHaveBeenCalledWith(["/vault"]);
  });

  describe("a vault drilled into a shared folder", () => {
    const collectionId = "3c4d5e6f-7a8b-4c9d-8e1f-2a3b4c5d6e7f";

    it("allows a folder the user holds under an organization they are a member of", async () => {
      collectionService.encryptedCollections$.mockReturnValue(of([collection(collectionId)]));

      await expect(runGuard(organizationId, collectionId)).resolves.toBe(true);
    });

    // Unassigned, deleted, or never existed — from here they are indistinguishable.
    it("redirects to the organization's vault for a folder the user cannot reach", async () => {
      await expect(runGuard(organizationId, collectionId)).resolves.toBe(organizationVaultUrlTree);
      expect(router.createUrlTree).toHaveBeenCalledWith(["/vault", organizationId]);
    });

    // The page narrows its collections to the vault in view, so the folder would resolve to nothing.
    it("redirects to the organization's vault for a folder another organization owns", async () => {
      collectionService.encryptedCollections$.mockReturnValue(
        of([collection(collectionId, otherOrganizationId)]),
      );

      await expect(runGuard(organizationId, collectionId)).resolves.toBe(organizationVaultUrlTree);
      expect(router.createUrlTree).toHaveBeenCalledWith(["/vault", organizationId]);
    });

    // Collections are null until the first sync writes them, which holds no folder to reach.
    it("redirects to the organization's vault when the collections have yet to load", async () => {
      collectionService.encryptedCollections$.mockReturnValue(of(null));

      await expect(runGuard(organizationId, collectionId)).resolves.toBe(organizationVaultUrlTree);
      expect(router.createUrlTree).toHaveBeenCalledWith(["/vault", organizationId]);
    });

    // Collections live in memory on web, so a reload empties them until the first sync.
    it("syncs before reading the collections when the account has yet to sync", async () => {
      const collections$ = new BehaviorSubject<Collection[] | null>(null);
      collectionService.encryptedCollections$.mockReturnValue(collections$);
      syncService.lastSync$.mockReturnValue(of(null));
      syncService.fullSync.mockImplementation(async () => {
        collections$.next([collection(collectionId)]);
        return true;
      });

      await expect(runGuard(organizationId, collectionId)).resolves.toBe(true);
      expect(syncService.fullSync).toHaveBeenCalledWith(false);
    });

    it("does not sync again when the account has already synced", async () => {
      collectionService.encryptedCollections$.mockReturnValue(of([collection(collectionId)]));

      await runGuard(organizationId, collectionId);

      expect(syncService.lastSync$).toHaveBeenCalledWith(userId);
      expect(syncService.fullSync).not.toHaveBeenCalled();
    });

    it("redirects to All items for a folder under an organization the user has left", async () => {
      await expect(runGuard(otherOrganizationId, collectionId)).resolves.toBe(allItemsUrlTree);
      expect(router.createUrlTree).toHaveBeenCalledWith(["/vault"]);
    });

    // A shared folder belongs to an organization, so no other vault can be drilled into one.
    it("redirects to All items for a folder under a vault that can hold none", async () => {
      await expect(runGuard(MY_VAULT_ROUTE, collectionId)).resolves.toBe(allItemsUrlTree);
      await expect(runGuard(TRASH_ROUTE, collectionId)).resolves.toBe(allItemsUrlTree);
      await expect(runGuard(ARCHIVE_ROUTE, collectionId)).resolves.toBe(allItemsUrlTree);
    });

    it("redirects to All items for a folder segment that names no collection", async () => {
      await expect(runGuard(organizationId, "engineering")).resolves.toBe(allItemsUrlTree);
      expect(router.createUrlTree).toHaveBeenCalledWith(["/vault"]);
    });
  });

  describe("a vault drilled into My items", () => {
    it("allows it for an organization that has such a collection", async () => {
      viewModel$.next(navViewModel([dataOwnershipVault], true));

      await expect(runGuard(organizationId, MY_ITEMS_ROUTE)).resolves.toBe(true);
    });

    // Only organizations under data ownership have one, so elsewhere the segment names nothing.
    it("redirects to All items for an organization that has none", async () => {
      await expect(runGuard(organizationId, MY_ITEMS_ROUTE)).resolves.toBe(allItemsUrlTree);
      expect(router.createUrlTree).toHaveBeenCalledWith(["/vault"]);
    });

    it("redirects to All items for an organization the user has left", async () => {
      await expect(runGuard(otherOrganizationId, MY_ITEMS_ROUTE)).resolves.toBe(allItemsUrlTree);
      expect(router.createUrlTree).toHaveBeenCalledWith(["/vault"]);
    });

    it("redirects to All items under a vault that can hold no collection", async () => {
      await expect(runGuard(MY_VAULT_ROUTE, MY_ITEMS_ROUTE)).resolves.toBe(allItemsUrlTree);
      await expect(runGuard(TRASH_ROUTE, MY_ITEMS_ROUTE)).resolves.toBe(allItemsUrlTree);
      await expect(runGuard(ARCHIVE_ROUTE, MY_ITEMS_ROUTE)).resolves.toBe(allItemsUrlTree);
    });
  });

  describe("a folder's page", () => {
    const folderId = "6f7a8b9c-1d2e-4f3a-8b4c-5d6e7f8a9b1c";
    const myFoldersUrlTree = mock<UrlTree>();

    const folder = (id: string): Folder => Object.assign(new Folder(), { id });

    const runFolderGuard = (segment: string) =>
      TestBed.runInInjectionContext(() =>
        vaultScopeGuard(
          {
            paramMap: convertToParamMap({ folderId: segment }),
            data: {},
          } as ActivatedRouteSnapshot,
          state,
        ),
      );

    beforeEach(() => {
      router.createUrlTree.mockImplementation((commands) =>
        (commands as unknown[])[0] === "/folders" ? myFoldersUrlTree : allItemsUrlTree,
      );
    });

    it("allows a folder the user holds", async () => {
      folderService.folders$.mockReturnValue(of([folder(folderId)]));

      await expect(runFolderGuard(folderId)).resolves.toBe(true);
    });

    // A folder's page lives outside the vault, so the list of folders is the nearest destination.
    it("redirects to My folders for a folder the user does not hold", async () => {
      await expect(runFolderGuard(folderId)).resolves.toBe(myFoldersUrlTree);
      expect(router.createUrlTree).toHaveBeenCalledWith(["/folders"]);
    });

    // Folders live in memory on web, so a reload empties them until the first sync.
    it("syncs before reading the folders when the account has yet to sync", async () => {
      const folders$ = new BehaviorSubject<Folder[]>([]);
      folderService.folders$.mockReturnValue(folders$);
      syncService.lastSync$.mockReturnValue(of(null));
      syncService.fullSync.mockImplementation(async () => {
        folders$.next([folder(folderId)]);
        return true;
      });

      await expect(runFolderGuard(folderId)).resolves.toBe(true);
      expect(syncService.fullSync).toHaveBeenCalledWith(false);
    });

    it("does not sync again when the account has already synced", async () => {
      folderService.folders$.mockReturnValue(of([folder(folderId)]));

      await runFolderGuard(folderId);

      expect(syncService.lastSync$).toHaveBeenCalledWith(userId);
      expect(syncService.fullSync).not.toHaveBeenCalled();
    });

    it("redirects to My folders for a segment that is no folder id, without reading folders", async () => {
      folderService.folders$.mockClear();

      await expect(runFolderGuard("not-a-guid")).resolves.toBe(myFoldersUrlTree);
      expect(folderService.folders$).not.toHaveBeenCalled();
    });

    it("reads the folders for the account it resolved, without decrypting them", async () => {
      folderService.folders$.mockClear();
      folderService.folderViews$.mockClear();

      await runFolderGuard(folderId);

      expect(folderService.folders$).toHaveBeenCalledWith(userId);
      expect(folderService.folderViews$).not.toHaveBeenCalled();
    });
  });

  // Only folders and collections are emptied by a reload; organizations persist across one.
  it("does not sync for a vault it can admit without reading folders or collections", async () => {
    syncService.lastSync$.mockReturnValue(of(null));

    await expect(runGuard(organizationId)).resolves.toBe(true);
    await expect(runGuard(MY_VAULT_ROUTE)).resolves.toBe(true);

    expect(syncService.fullSync).not.toHaveBeenCalled();
  });

  it("does not resolve the account's vaults for a segment it can reject outright", async () => {
    vaultNavService.viewModel$.mockClear();

    await runGuard("acme-corp");

    expect(vaultNavService.viewModel$).not.toHaveBeenCalled();
  });

  // Resolving the active account twice could pair one account's vaults with another's collections.
  it("reads the vaults and the collections for the one account it resolved", async () => {
    collectionService.encryptedCollections$.mockClear();
    vaultNavService.viewModel$.mockClear();

    await runGuard(organizationId, "3c4d5e6f-7a8b-4c9d-8e1f-2a3b4c5d6e7f");

    expect(vaultNavService.viewModel$).toHaveBeenCalledWith(userId);
    expect(collectionService.encryptedCollections$).toHaveBeenCalledWith(userId);
  });

  // Decrypting waits on the org keys and then every collection, for an id and an organization that
  // are plaintext either way — a cost the guard would put on every drilled-in navigation.
  it("does not decrypt the collections to decide whether a folder is reachable", async () => {
    collectionService.decryptedCollections$.mockClear();

    await runGuard(organizationId, "3c4d5e6f-7a8b-4c9d-8e1f-2a3b4c5d6e7f");

    expect(collectionService.decryptedCollections$).not.toHaveBeenCalled();
  });
});
