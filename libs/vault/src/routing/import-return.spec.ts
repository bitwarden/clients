import { ActivatedRoute, convertToParamMap } from "@angular/router";

import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";

import { VaultNavItemType, VaultsNavViewModel } from "../models/vault-nav-view-model";
import { MY_ITEMS_ROUTE, VaultScope, VaultScopeType } from "../models/vault-scope";

import { importStartedFrom, vaultCommandsAfterImport } from "./import-return";

const organizationId = "5bb2e4b0-5d4e-4a58-9a6a-3a5f5b8c2f11" as OrganizationId;
const myItemsId = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d" as CollectionId;
const sharedFolderId = "9c1d7e2a-3b4f-4c5d-8e6f-7a8b9c0d1e2f" as CollectionId;
const folderId = "6f1e2d3c-4b5a-4c6d-8e7f-9a0b1c2d3e4f";

const nav: VaultsNavViewModel = {
  organizationDataOwnership: true,
  vaults: [
    {
      id: organizationId,
      label: "Org",
      icon: "bwi-business",
      type: VaultNavItemType.Organization,
      defaultUserCollectionId: myItemsId,
      enabled: true,
    },
  ],
};

const routeWith = (query: Record<string, string>) =>
  ({ snapshot: { queryParamMap: convertToParamMap(query) } }) as unknown as ActivatedRoute;

describe("importStartedFrom", () => {
  it.each<[VaultScope, string | undefined]>([
    [{ type: VaultScopeType.AllItems }, undefined],
    [{ type: VaultScopeType.MyVault }, "my-vault"],
    [{ type: VaultScopeType.Trash }, "trash"],
    [{ type: VaultScopeType.Archive }, "archive"],
    [{ type: VaultScopeType.Folder, folderId }, folderId],
    [{ type: VaultScopeType.Organization, organizationId }, undefined],
    [
      { type: VaultScopeType.Organization, organizationId, collectionId: sharedFolderId },
      undefined,
    ],
    [
      { type: VaultScopeType.Organization, organizationId, collectionId: MY_ITEMS_ROUTE },
      "my-items",
    ],
    [{ type: VaultScopeType.Organization, organizationId, collectionId: myItemsId }, "my-items"],
  ])("names the page for %j", (scope, expected) => {
    expect(importStartedFrom(scope, nav)).toBe(expected);
  });

  it("does not take a collection for My items before the nav has loaded", () => {
    expect(
      importStartedFrom(
        { type: VaultScopeType.Organization, organizationId, collectionId: myItemsId },
        undefined,
      ),
    ).toBeUndefined();
  });
});

describe("vaultCommandsAfterImport", () => {
  it("is All items when the import was started from none", () => {
    expect(vaultCommandsAfterImport(routeWith({}))).toEqual(["/vault"]);
  });

  it.each([
    ["my-vault", ["/vault", "my-vault"]],
    ["trash", ["/vault", "trash"]],
    ["archive", ["/vault", "archive"]],
    [folderId, ["/folders", folderId]],
  ])("returns to the personal page %s", (startedFrom, expected) => {
    expect(vaultCommandsAfterImport(routeWith({ startedFrom }))).toEqual(expected);
  });

  it("is the organization's vault when the import was started from it", () => {
    expect(vaultCommandsAfterImport(routeWith({ defaultOrganizationId: organizationId }))).toEqual([
      "/vault",
      organizationId,
    ]);
  });

  it("is the shared folder when the import was started from one", () => {
    expect(
      vaultCommandsAfterImport(
        routeWith({ defaultOrganizationId: organizationId, defaultCollectionId: sharedFolderId }),
      ),
    ).toEqual(["/vault", organizationId, "shared-folders", sharedFolderId]);
  });

  it("is the organization's My items page, not its shared folder, when started from it", () => {
    expect(
      vaultCommandsAfterImport(
        routeWith({
          defaultOrganizationId: organizationId,
          defaultCollectionId: myItemsId,
          startedFrom: "my-items",
        }),
      ),
    ).toEqual(["/vault", organizationId, "my-items"]);
  });

  it("is All items for an organization that is not an id", () => {
    expect(vaultCommandsAfterImport(routeWith({ defaultOrganizationId: "nope" }))).toEqual([
      "/vault",
    ]);
  });

  it("is All items for a value that is neither a known page nor an id", () => {
    expect(vaultCommandsAfterImport(routeWith({ startedFrom: "https://evil.example" }))).toEqual([
      "/vault",
    ]);
  });

  it("is All items for My items named without its organization", () => {
    expect(vaultCommandsAfterImport(routeWith({ startedFrom: "my-items" }))).toEqual(["/vault"]);
  });
});
