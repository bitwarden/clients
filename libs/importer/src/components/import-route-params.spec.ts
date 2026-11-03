import { ActivatedRoute, convertToParamMap, Router } from "@angular/router";
import { mock } from "jest-mock-extended";

import {
  importQueryParamsForVault,
  importScopeFromQuery,
  importStartedFromQuery,
  navigateCarryingImportParams,
} from "./import-route-params";

const orgId = "5bb2e4b0-5d4e-4a58-9a6a-3a5f5b8c2f11";
const collectionId = "9c1d7e2a-3b4f-4c5d-8e6f-7a8b9c0d1e2f";

const routeWith = (query: Record<string, string>) =>
  ({ snapshot: { queryParamMap: convertToParamMap(query) } }) as unknown as ActivatedRoute;

describe("importScopeFromQuery", () => {
  it("reads the organization and collection from the URL", () => {
    expect(
      importScopeFromQuery(
        routeWith({ defaultOrganizationId: orgId, defaultCollectionId: collectionId }),
      ),
    ).toEqual({ defaultOrganizationId: orgId, defaultCollectionId: collectionId });
  });

  it("is empty without a scope", () => {
    expect(importScopeFromQuery(routeWith({}))).toEqual({
      defaultOrganizationId: undefined,
      defaultCollectionId: undefined,
    });
  });

  it("drops a value that is not an id, whichever param holds it", () => {
    expect(
      importScopeFromQuery(
        routeWith({ defaultOrganizationId: "not-an-id", defaultCollectionId: collectionId }),
      ),
    ).toEqual({ defaultOrganizationId: undefined, defaultCollectionId: collectionId });
    expect(
      importScopeFromQuery(
        routeWith({ defaultOrganizationId: orgId, defaultCollectionId: "<script>" }),
      ),
    ).toEqual({ defaultOrganizationId: orgId, defaultCollectionId: undefined });
  });
});

describe("importQueryParamsForVault", () => {
  it("is the organization and the collection of an organization's shared folder", () => {
    expect(importQueryParamsForVault(orgId, collectionId)).toEqual({
      defaultOrganizationId: orgId,
      defaultCollectionId: collectionId,
    });
  });

  it("is just the organization for an organization's vault with no collection", () => {
    expect(importQueryParamsForVault(orgId, undefined)).toEqual({ defaultOrganizationId: orgId });
  });

  it("is undefined for a vault that is not an organization's", () => {
    expect(importQueryParamsForVault(undefined, undefined)).toBeUndefined();
  });

  it("drops a collection that has no organization", () => {
    expect(importQueryParamsForVault(undefined, collectionId)).toBeUndefined();
  });

  it("is just the page the import was started from for a personal page", () => {
    expect(importQueryParamsForVault(undefined, undefined, "my-vault")).toEqual({
      startedFrom: "my-vault",
    });
  });

  it("adds the page to an organization's scope", () => {
    expect(importQueryParamsForVault(orgId, collectionId, "my-items")).toEqual({
      defaultOrganizationId: orgId,
      defaultCollectionId: collectionId,
      startedFrom: "my-items",
    });
  });
});

describe("importStartedFromQuery", () => {
  it.each(["my-vault", "trash", "archive", "my-items", collectionId])("keeps %s", (value) => {
    expect(importStartedFromQuery(routeWith({ startedFrom: value }))).toBe(value);
  });

  it.each(["", "/vault", "https://evil.example", "folders/x", "not-an-id"])(
    "drops %j, which is neither a known page nor an id",
    (value) => {
      expect(importStartedFromQuery(routeWith({ startedFrom: value }))).toBeUndefined();
    },
  );

  it("is undefined without the param", () => {
    expect(importStartedFromQuery(routeWith({}))).toBeUndefined();
  });
});

describe("navigateCarryingImportParams", () => {
  const router = mock<Router>();

  beforeEach(() => {
    router.navigate.mockReset();
    router.navigate.mockResolvedValue(true);
  });

  it("navigates with just the commands when there is nothing to carry", async () => {
    await navigateCarryingImportParams(router, routeWith({}), ["/a", "b"]);

    expect(router.navigate).toHaveBeenCalledWith(["/a", "b"]);
  });

  it("passes the caller's extras through when there is nothing to carry", async () => {
    await navigateCarryingImportParams(router, routeWith({ source: "x" }), ["/a"], {
      queryParams: { source: "keeper" },
    });

    expect(router.navigate).toHaveBeenCalledWith(["/a"], { queryParams: { source: "keeper" } });
  });

  it("carries returnTo and the vault scope, and nothing else, into the next URL", async () => {
    await navigateCarryingImportParams(
      router,
      routeWith({
        returnTo: "access-intelligence",
        defaultOrganizationId: orgId,
        defaultCollectionId: collectionId,
        source: "keeper",
      }),
      ["/a"],
    );

    expect(router.navigate).toHaveBeenCalledWith(["/a"], {
      queryParams: {
        returnTo: "access-intelligence",
        defaultOrganizationId: orgId,
        defaultCollectionId: collectionId,
      },
    });
  });

  it("carries the page the import was started from", async () => {
    await navigateCarryingImportParams(router, routeWith({ startedFrom: "trash" }), ["/a"]);

    expect(router.navigate).toHaveBeenCalledWith(["/a"], { queryParams: { startedFrom: "trash" } });
  });

  it("merges what it carries with the caller's own query params", async () => {
    await navigateCarryingImportParams(
      router,
      routeWith({ defaultOrganizationId: orgId }),
      ["/a"],
      {
        queryParams: { source: "keeper" },
      },
    );

    expect(router.navigate).toHaveBeenCalledWith(["/a"], {
      queryParams: { defaultOrganizationId: orgId, source: "keeper" },
    });
  });
});
