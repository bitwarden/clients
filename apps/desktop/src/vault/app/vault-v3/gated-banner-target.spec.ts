import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";
import { ALL_ITEMS_SCOPE, MY_ITEMS_ROUTE, VaultScopeType } from "@bitwarden/vault";

import { gatedBannerTarget } from "./gated-banner-target";

describe("gatedBannerTarget", () => {
  const organizationId = "org-id" as OrganizationId;
  const collectionId = "collection-id" as CollectionId;

  it("names the organization and shared folder the scope drilled into", () => {
    expect(
      gatedBannerTarget({ type: VaultScopeType.Organization, organizationId, collectionId }),
    ).toEqual({ organizationId, collectionId });
  });

  it("is unset for an organization's whole vault", () => {
    expect(
      gatedBannerTarget({ type: VaultScopeType.Organization, organizationId }),
    ).toBeUndefined();
  });

  it("is unset for an organization's My items", () => {
    expect(
      gatedBannerTarget({
        type: VaultScopeType.Organization,
        organizationId,
        collectionId: MY_ITEMS_ROUTE,
      }),
    ).toBeUndefined();
  });

  it("is unset outside an organization vault", () => {
    expect(gatedBannerTarget(ALL_ITEMS_SCOPE)).toBeUndefined();
    expect(gatedBannerTarget({ type: VaultScopeType.Folder, folderId: "f" })).toBeUndefined();
  });
});
