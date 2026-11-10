import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { ChipFilterOption } from "@bitwarden/components";
import {
  ALL_ITEMS_SCOPE,
  VaultNavItemType,
  VaultScopeType,
  type VaultsNavViewModel,
} from "@bitwarden/vault";

import { collectionOptionsInScope } from "./filter-options";

describe("collectionOptionsInScope", () => {
  const organizationId = "org-1" as OrganizationId;
  const myItemsId = "my-items-1" as CollectionId;

  const option = (
    id: string,
    orgId: string = organizationId,
  ): ChipFilterOption<CollectionView> => ({
    value: { id, organizationId: orgId } as CollectionView,
    label: id,
  });

  const nav: VaultsNavViewModel = {
    vaults: [
      {
        id: organizationId,
        label: "Acme",
        icon: "bwi-business",
        type: VaultNavItemType.Organization,
        defaultUserCollectionId: myItemsId,
        enabled: true,
      },
    ],
    organizationDataOwnership: true,
  };

  /** The vault switcher offers My items, so it isn't listed as a shared folder too. */
  it("leaves out each organization's My items", () => {
    const options = collectionOptionsInScope(
      [option(myItemsId), option("shared")],
      ALL_ITEMS_SCOPE,
      nav,
    );

    expect(options.map((o) => o.value.id)).toEqual(["shared"]);
  });

  it("keeps every collection until the account's vaults load", () => {
    const options = collectionOptionsInScope(
      [option(myItemsId), option("shared")],
      ALL_ITEMS_SCOPE,
      undefined,
    );

    expect(options.map((o) => o.value.id)).toEqual([myItemsId, "shared"]);
  });

  it("narrows to the scoped organization's collections", () => {
    const options = collectionOptionsInScope(
      [option("shared"), option("elsewhere", "org-2")],
      { type: VaultScopeType.Organization, organizationId },
      nav,
    );

    expect(options.map((o) => o.value.id)).toEqual(["shared"]);
  });
});
