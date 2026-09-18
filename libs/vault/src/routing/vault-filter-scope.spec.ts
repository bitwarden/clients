import { ChangeDetectionStrategy, Component } from "@angular/core";
import { fakeAsync, TestBed, tick } from "@angular/core/testing";
import { provideRouter, Router } from "@angular/router";

import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";

import {
  ALL_ITEMS_SCOPE,
  MY_ITEMS_ROUTE,
  MY_VAULT_ROUTE,
  SHARED_FOLDERS_ROUTE,
  VaultScopeType,
} from "../models/vault-scope";

import { MY_ITEMS_ROUTE_DATA } from "./scoped-collection";
import {
  hasFilterParams,
  rememberableParams,
  vaultScopeOf,
  type VaultScopeRouteData,
} from "./vault-filter-scope";

@Component({ template: "", standalone: true, changeDetection: ChangeDetectionStrategy.OnPush })
class BlankComponent {}

const inScope = { vaultFilterScope: true } satisfies VaultScopeRouteData;

const organizationId = "2f8b1c14-9a3d-4f6e-8b21-5d7c0e9a3b44" as OrganizationId;
const collectionId = "6b4d2e70-1c58-4a92-9f3e-8c0a5d21b7f6" as CollectionId;

const organizationScope = { type: VaultScopeType.Organization, organizationId } as const;

describe("vaultScopeOf", () => {
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          // Mirrors web: a pathless shell route holds the `vault` path, which in turn lazy-loads the
          // routes that declare the scope. Nothing on the way down carries the vault's own segment,
          // which is the shape a positional read of the URL would get wrong.
          {
            path: "",
            children: [
              {
                path: "vault",
                children: [
                  { path: "", component: BlankComponent, data: inScope },
                  { path: ":vaultId", component: BlankComponent, data: inScope },
                  {
                    path: `:vaultId/${MY_ITEMS_ROUTE}`,
                    component: BlankComponent,
                    data: { ...MY_ITEMS_ROUTE_DATA, ...inScope },
                  },
                  {
                    path: `:vaultId/${SHARED_FOLDERS_ROUTE}/:collectionId`,
                    component: BlankComponent,
                    data: inScope,
                  },
                  { path: ":vaultId/item/:itemId", component: BlankComponent, data: inScope },
                ],
              },
            ],
          },
          { path: "sends", component: BlankComponent },
        ]),
      ],
    });
    router = TestBed.inject(Router);
  });

  /** Navigates, then resolves the scope the same way the memory service does. */
  function scopeOf(url: string) {
    void router.navigateByUrl(url);
    tick();
    return vaultScopeOf(router.routerState.snapshot);
  }

  it("resolves a vault route with no vault param to the all-items scope", fakeAsync(() => {
    expect(scopeOf("/vault")).toEqual(ALL_ITEMS_SCOPE);
  }));

  it("ignores query params when resolving the scope", fakeAsync(() => {
    expect(scopeOf("/vault?vault.type=1&vault.sort=name")).toEqual(ALL_ITEMS_SCOPE);
  }));

  it("returns null for a route that did not opt in", fakeAsync(() => {
    expect(scopeOf("/sends")).toBeNull();
  }));

  it("scopes the individual vault route to the my-vault scope", fakeAsync(() => {
    expect(scopeOf(`/vault/${MY_VAULT_ROUTE}`)).toEqual({ type: VaultScopeType.MyVault });
  }));

  it("scopes an organization's vault route to its id", fakeAsync(() => {
    expect(scopeOf(`/vault/${organizationId}`)).toEqual(organizationScope);
  }));

  it("scopes a shared folder drill-in to the folder within its organization", fakeAsync(() => {
    expect(scopeOf(`/vault/${organizationId}/${SHARED_FOLDERS_ROUTE}/${collectionId}`)).toEqual({
      ...organizationScope,
      collectionId,
    });
  }));

  // The "My items" route has no `:collectionId` of its own, so its collection comes from the route
  // data — see `MY_ITEMS_ROUTE_DATA`.
  it("scopes the My items route to the sentinel collection", fakeAsync(() => {
    expect(scopeOf(`/vault/${organizationId}/${MY_ITEMS_ROUTE}`)).toEqual({
      ...organizationScope,
      collectionId: MY_ITEMS_ROUTE,
    });
  }));

  it("returns null for a vault param that names no vault", fakeAsync(() => {
    expect(scopeOf("/vault/not-a-vault")).toBeNull();
  }));

  // The scope's param is declared on the vault route, so a child showing one of its items shares it
  // rather than resolving to a scope of its own.
  it("resolves a child of a vault route to the vault's scope", fakeAsync(() => {
    expect(scopeOf(`/vault/${MY_VAULT_ROUTE}/item/c-1`)).toEqual({ type: VaultScopeType.MyVault });
  }));
});

describe("rememberableParams", () => {
  it("keeps the filter chips' params", () => {
    expect(
      rememberableParams({ "vault.type": "1", "vault.folder": "f-1", "vault.favorites": "true" }),
    ).toEqual({ "vault.type": "1", "vault.folder": "f-1", "vault.favorites": "true" });
  });

  it("keeps sort, which shares the filter namespace", () => {
    expect(rememberableParams({ "vault.sort": "name", "vault.direction": "asc" })).toEqual({
      "vault.sort": "name",
      "vault.direction": "asc",
    });
  });

  it("drops the search term", () => {
    expect(rememberableParams({ "vault.type": "1", "vault.search": "chase" })).toEqual({
      "vault.type": "1",
    });
  });

  it("drops params outside the filter namespace", () => {
    expect(rememberableParams({ "vault.type": "1", itemId: "c-1", action: "view" })).toEqual({
      "vault.type": "1",
    });
  });

  it("drops a namespaced param it doesn't recognize", () => {
    expect(rememberableParams({ "vault.type": "1", "vault.selectedRow": "c-1" })).toEqual({
      "vault.type": "1",
    });
  });

  it("returns nothing for a URL with no filter params", () => {
    expect(rememberableParams({ itemId: "c-1" })).toEqual({});
  });
});

describe("hasFilterParams", () => {
  it("is true for a param under the filter namespace", () => {
    expect(hasFilterParams({ "vault.type": "1" })).toBe(true);
  });

  it("is true for a search term alone", () => {
    expect(hasFilterParams({ "vault.search": "chase" })).toBe(true);
  });

  it("is false for params outside the filter namespace", () => {
    expect(hasFilterParams({ itemId: "c-1", action: "view" })).toBe(false);
  });

  it("is false for a URL with no params", () => {
    expect(hasFilterParams({})).toBe(false);
  });
});
