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
import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { CollectionId, OrganizationId, UserId } from "@bitwarden/common/types/guid";

import {
  VaultNavItemType,
  VaultNavItemViewModel,
  VaultsNavViewModel,
} from "../models/vault-nav-view-model";
import { ARCHIVE_ROUTE, MY_ITEMS_ROUTE, MY_VAULT_ROUTE, TRASH_ROUTE } from "../models/vault-scope";
import { VaultNavService } from "../services/vault-nav.service";

import { vaultScopeGuard } from "./vault-scope.guard";

describe("vaultScopeGuard", () => {
  const userId = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d" as UserId;
  const organizationId = "1b2c3d4e-5f60-4a1b-8c2d-3e4f5a6b7c8d" as OrganizationId;
  const otherOrganizationId = "9a8b7c6d-5e4f-4a3b-8c2d-1e2f3a4b5c6d" as OrganizationId;

  const state = mock<RouterStateSnapshot>();
  const allItemsUrlTree = mock<UrlTree>();
  const organizationVaultUrlTree = mock<UrlTree>();

  let router: MockProxy<Router>;

  // `viewModel$` is readonly on the service, so it can't be assigned onto the mock.
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
  };

  const organizationVault: VaultNavItemViewModel = {
    id: organizationId,
    label: "Acme corporation",
    color: "purple",
    icon: "bwi-business",
    type: VaultNavItemType.Organization,
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

  /** A shared folder of the organization the account is a member of, as the user holds it. */
  const collection = (id: string, orgId: OrganizationId = organizationId) =>
    new CollectionView({ id: id as CollectionId, organizationId: orgId, name: "Engineering" });

  const makeRoute = (vaultId?: string, collectionId?: string): ActivatedRouteSnapshot =>
    mock<ActivatedRouteSnapshot>({
      paramMap: convertToParamMap({
        ...(vaultId == null ? {} : { vaultId }),
        ...(collectionId == null ? {} : { collectionId }),
      }),
    });

  const runGuard = (vaultId?: string, collectionId?: string) =>
    TestBed.runInInjectionContext(() => vaultScopeGuard(makeRoute(vaultId, collectionId), state));

  beforeEach(() => {
    router = mock<Router>();
    // The organization vault is the only redirect that carries a segment beyond "/vault".
    router.createUrlTree.mockImplementation((commands) =>
      (commands as unknown[]).length > 1 ? organizationVaultUrlTree : allItemsUrlTree,
    );

    viewModel$.next(navViewModel([personalVault, organizationVault]));
    Object.defineProperty(vaultNavService, "viewModel$", { value: viewModel$ });

    accountService.activeAccount$ = of({ id: userId } as Account);
    collectionService.decryptedCollections$.mockReturnValue(of([]));

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: router },
        { provide: VaultNavService, useValue: vaultNavService },
        { provide: AccountService, useValue: accountService },
        { provide: CollectionService, useValue: collectionService },
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
      collectionService.decryptedCollections$.mockReturnValue(of([collection(collectionId)]));

      await expect(runGuard(organizationId, collectionId)).resolves.toBe(true);
    });

    // Unassigned, deleted, or never existed — from here they are indistinguishable.
    it("redirects to the organization's vault for a folder the user cannot reach", async () => {
      await expect(runGuard(organizationId, collectionId)).resolves.toBe(organizationVaultUrlTree);
      expect(router.createUrlTree).toHaveBeenCalledWith(["/vault", organizationId]);
    });

    // The page narrows its collections to the vault in view, so the folder would resolve to nothing.
    it("redirects to the organization's vault for a folder another organization owns", async () => {
      collectionService.decryptedCollections$.mockReturnValue(
        of([collection(collectionId, otherOrganizationId)]),
      );

      await expect(runGuard(organizationId, collectionId)).resolves.toBe(organizationVaultUrlTree);
      expect(router.createUrlTree).toHaveBeenCalledWith(["/vault", organizationId]);
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

  it("does not resolve the account's vaults for a segment it can reject outright", async () => {
    const subscribe = jest.spyOn(viewModel$, "subscribe");

    await runGuard("acme-corp");

    expect(subscribe).not.toHaveBeenCalled();
    subscribe.mockRestore();
  });
});
