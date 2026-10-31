import { TestBed } from "@angular/core/testing";
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from "@angular/router";
import { BehaviorSubject } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import {
  VAULT_BASE_ROUTE,
  VaultNavItemType,
  VaultNavService,
  VaultsNavViewModel,
} from "@bitwarden/vault";

import { VaultPopupListTableFiltersService } from "../services/vault-popup-list-table-filters.service";

import { restoreVaultScopeGuard } from "./restore-vault-scope.guard";

const ORG_ID = "6b0a3a9c-0b5e-4d8d-9a43-1f0c5e0e7a11";

const personal = {
  id: "user-1",
  type: VaultNavItemType.Personal,
  label: "My vault",
  icon: "bwi-user",
  enabled: true,
} as const;
const organization = {
  id: ORG_ID,
  type: VaultNavItemType.Organization,
  label: "Acme",
  icon: "bwi-business",
  enabled: true,
} as const;

describe("restoreVaultScopeGuard", () => {
  const createUrlTree = jest.fn((commands: string[]) => ({ commands }) as unknown as UrlTree);
  const nav$ = new BehaviorSubject<VaultsNavViewModel>({
    vaults: [personal, organization],
    organizationDataOwnership: false,
  });
  let stored: string | null;
  const listFiltersService = {
    storedVaultScopeId: jest.fn(async (): Promise<string | null> => stored),
    setCachedVaultScopeId: jest.fn(async (): Promise<void> => undefined),
  };

  const run = () =>
    TestBed.runInInjectionContext(() =>
      restoreVaultScopeGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );

  beforeEach(() => {
    stored = null;
    createUrlTree.mockClear();
    listFiltersService.setCachedVaultScopeId.mockClear();
    nav$.next({ vaults: [personal, organization], organizationDataOwnership: false });

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: { createUrlTree } },
        { provide: AccountService, useValue: mockAccountServiceWith("user-1" as UserId) },
        { provide: VaultNavService, useValue: { viewModel$: () => nav$ } },
        { provide: VAULT_BASE_ROUTE, useValue: "/tabs/vault" },
        { provide: VaultPopupListTableFiltersService, useValue: listFiltersService },
      ],
    });
  });

  it("lets the unscoped route through when no vault is stored", async () => {
    expect(await run()).toBe(true);
    expect(createUrlTree).not.toHaveBeenCalled();
  });

  it("redirects to the stored organization's vault", async () => {
    stored = ORG_ID;

    await run();

    expect(createUrlTree).toHaveBeenCalledWith(["/tabs/vault", ORG_ID]);
  });

  it("redirects to the stored personal vault", async () => {
    stored = "my-vault";

    await run();

    expect(createUrlTree).toHaveBeenCalledWith(["/tabs/vault", "my-vault"]);
  });

  it("drops a stored organization the account no longer offers, rather than redirecting", async () => {
    stored = ORG_ID;
    nav$.next({ vaults: [personal], organizationDataOwnership: false });

    expect(await run()).toBe(true);
    expect(createUrlTree).not.toHaveBeenCalled();
    expect(listFiltersService.setCachedVaultScopeId).toHaveBeenCalledWith(null);
  });

  it("drops a stored personal vault on an account whose only vault is personal", async () => {
    stored = "my-vault";
    nav$.next({ vaults: [personal], organizationDataOwnership: false });

    expect(await run()).toBe(true);
    expect(listFiltersService.setCachedVaultScopeId).toHaveBeenCalledWith(null);
  });
});
