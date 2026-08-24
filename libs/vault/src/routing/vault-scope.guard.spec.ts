import { TestBed } from "@angular/core/testing";
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  convertToParamMap,
} from "@angular/router";
import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { OrganizationId, UserId } from "@bitwarden/common/types/guid";

import {
  VaultNavItemType,
  VaultNavItemViewModel,
  VaultsNavViewModel,
} from "../models/vault-nav-view-model";
import { ARCHIVE_ROUTE, MY_VAULT_ROUTE, TRASH_ROUTE } from "../models/vault-scope";
import { VaultNavService } from "../services/vault-nav.service";

import { vaultScopeGuard } from "./vault-scope.guard";

describe("vaultScopeGuard", () => {
  const userId = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d" as UserId;
  const organizationId = "1b2c3d4e-5f60-4a1b-8c2d-3e4f5a6b7c8d" as OrganizationId;
  const otherOrganizationId = "9a8b7c6d-5e4f-4a3b-8c2d-1e2f3a4b5c6d" as OrganizationId;

  const state = mock<RouterStateSnapshot>();
  const allItemsUrlTree = mock<UrlTree>();

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

  const navViewModel = (
    vaults: VaultNavItemViewModel[],
    organizationDataOwnership = false,
  ): VaultsNavViewModel => ({ vaults, organizationDataOwnership });

  const makeRoute = (vaultId?: string): ActivatedRouteSnapshot =>
    mock<ActivatedRouteSnapshot>({
      paramMap: convertToParamMap(vaultId == null ? {} : { vaultId }),
    });

  const runGuard = (vaultId?: string) =>
    TestBed.runInInjectionContext(() => vaultScopeGuard(makeRoute(vaultId), state));

  beforeEach(() => {
    router = mock<Router>();
    router.createUrlTree.mockReturnValue(allItemsUrlTree);

    viewModel$.next(navViewModel([personalVault, organizationVault]));
    Object.defineProperty(vaultNavService, "viewModel$", { value: viewModel$ });

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: router },
        { provide: VaultNavService, useValue: vaultNavService },
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

  it("does not resolve the account's vaults for a segment it can reject outright", async () => {
    const subscribe = jest.spyOn(viewModel$, "subscribe");

    await runGuard("acme-corp");

    expect(subscribe).not.toHaveBeenCalled();
    subscribe.mockRestore();
  });
});
