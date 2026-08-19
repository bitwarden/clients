import { ChangeDetectionStrategy, Component } from "@angular/core";
import { fakeAsync, TestBed, tick } from "@angular/core/testing";
import { provideRouter, Router } from "@angular/router";

import {
  ALL_ITEMS_SCOPE,
  MY_VAULT_SCOPE,
  rememberableParams,
  toVaultScope,
  vaultScopeOf,
  type VaultScopeRouteData,
} from "./vault-scope";

/** Stands in as the target of every route the tests navigate to. */
@Component({ template: "", standalone: true, changeDetection: ChangeDetectionStrategy.OnPush })
class BlankComponent {}

const inScope = { vaultFilterScope: true } satisfies VaultScopeRouteData;

describe("vaultScopeOf", () => {
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          // Mirrors web, where the vault is mounted under a pathless shell route.
          {
            path: "",
            children: [
              { path: "vault", component: BlankComponent, data: inScope },
              { path: "vault/:vaultId", component: BlankComponent, data: inScope },
              {
                path: "vault/:vaultId/item/:itemId",
                component: BlankComponent,
                data: inScope,
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
    expect(scopeOf("/vault")).toBe(ALL_ITEMS_SCOPE);
  }));

  it("ignores query params when resolving the scope", fakeAsync(() => {
    expect(scopeOf("/vault?vault.type=1&vault.sort=name")).toBe(ALL_ITEMS_SCOPE);
  }));

  it("returns null for a route that did not opt in", fakeAsync(() => {
    expect(scopeOf("/sends")).toBeNull();
  }));

  it("scopes the individual vault route to the my-vault scope", fakeAsync(() => {
    expect(scopeOf(`/vault/${MY_VAULT_SCOPE}`)).toBe(MY_VAULT_SCOPE);
  }));

  it("scopes an organization's vault route to its id", fakeAsync(() => {
    expect(scopeOf("/vault/2f8b1c14-9a3d-4f6e-8b21-5d7c0e9a3b44")).toBe(
      "2f8b1c14-9a3d-4f6e-8b21-5d7c0e9a3b44",
    );
  }));

  it("returns null for a vault param that names no vault", fakeAsync(() => {
    expect(scopeOf("/vault/not-a-vault")).toBeNull();
  }));

  // The scope's param is declared on the vault route, so a child showing one of its items shares it
  // rather than resolving to a scope of its own.
  it("resolves a child of a vault route to the vault's scope", fakeAsync(() => {
    expect(scopeOf(`/vault/${MY_VAULT_SCOPE}/item/c-1`)).toBe(MY_VAULT_SCOPE);
  }));
});

describe("toVaultScope", () => {
  it("accepts the aggregate scopes", () => {
    expect(toVaultScope(ALL_ITEMS_SCOPE)).toBe(ALL_ITEMS_SCOPE);
    expect(toVaultScope(MY_VAULT_SCOPE)).toBe(MY_VAULT_SCOPE);
  });

  it("accepts an organization id", () => {
    expect(toVaultScope("2f8b1c14-9a3d-4f6e-8b21-5d7c0e9a3b44")).toBe(
      "2f8b1c14-9a3d-4f6e-8b21-5d7c0e9a3b44",
    );
  });

  it("rejects a string that names no vault", () => {
    expect(toVaultScope("my-vault")).toBeUndefined();
    expect(toVaultScope("trash")).toBeUndefined();
    expect(toVaultScope("")).toBeUndefined();
  });
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

  it("returns nothing for a URL with no filter params", () => {
    expect(rememberableParams({ itemId: "c-1" })).toEqual({});
  });
});
