import { TestBed } from "@angular/core/testing";
import { provideRouter, Router } from "@angular/router";

import { ALL_ITEMS_SCOPE, rememberableParams, vaultScopeKey } from "./vault-scope";

describe("vaultScopeKey", () => {
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    router = TestBed.inject(Router);
  });

  /** Parses a URL the same way the memory service does before resolving its scope. */
  function scopeOf(url: string): string | null {
    return vaultScopeKey(router.parseUrl(url));
  }

  it("resolves the top-level vault route to the all-items scope", () => {
    expect(scopeOf("/vault")).toBe(ALL_ITEMS_SCOPE);
  });

  it("ignores query params when resolving the scope", () => {
    expect(scopeOf("/vault?vault.type=1&vault.sort=name")).toBe(ALL_ITEMS_SCOPE);
  });

  it("returns null for a non-vault route", () => {
    expect(scopeOf("/sends")).toBeNull();
    expect(scopeOf("/settings/account")).toBeNull();
    expect(scopeOf("/")).toBeNull();
  });

  it("does not treat a route merely containing 'vault' as a vault route", () => {
    expect(scopeOf("/organizations/org-1/vault")).toBeNull();
  });

  // The routes below don't exist yet — PM-42183 adds them. They key themselves off the second
  // segment, so this function shouldn't need to change when they land.
  it("scopes a named child vault route to its segment", () => {
    expect(scopeOf("/vault/my-vault")).toBe("my-vault");
  });

  it("scopes an organization's vault route to its id", () => {
    expect(scopeOf("/vault/2f8b1c14-9a3d-4f6e-8b21-5d7c0e9a3b44")).toBe(
      "2f8b1c14-9a3d-4f6e-8b21-5d7c0e9a3b44",
    );
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

  it("drops the page number", () => {
    expect(rememberableParams({ "vault.type": "1", "vault.page": "7" })).toEqual({
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
