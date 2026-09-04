import { ProductTierType } from "@bitwarden/common/billing/enums";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { BitwardenIcon } from "@bitwarden/components";

import {
  ALL_ITEMS_ICON_TILE,
  navIconTile,
  orgIconTile,
  personalIconTile,
  vaultScopeHeaderTile,
  vaultTileColor,
} from "./vault-icon-tile";
import {
  VaultNavItemType,
  VaultNavItemViewModel,
  VaultsNavViewModel,
} from "./vault-nav-view-model";
import { VaultScopeType } from "./vault-scope";

describe("vaultTileColor", () => {
  it("resolves a palette avatar color to its hex value", () => {
    expect(vaultTileColor("teal")).toBe("#007c95");
  });

  it("passes a custom hex color through untouched", () => {
    expect(vaultTileColor("#abcdef")).toBe("#abcdef");
  });
});

describe("orgIconTile", () => {
  it.each([
    [ProductTierType.Free, "bwi-family", "teal"],
    [ProductTierType.Families, "bwi-family", "teal"],
    [ProductTierType.Teams, "bwi-business", "purple"],
    [ProductTierType.TeamsStarter, "bwi-business", "purple"],
    [ProductTierType.Enterprise, "bwi-business", "purple"],
  ])("maps tier %s to the %s icon on the %s variant", (tier, icon, variant) => {
    expect(orgIconTile(tier)).toEqual({ icon, variant, emphasis: "bold" });
  });

  it("groups Free and Families onto one tile, matching the side nav", () => {
    expect(orgIconTile(ProductTierType.Free)).toEqual(orgIconTile(ProductTierType.Families));
  });

  // The tile has to resolve through the decorative theme tokens to adapt to dark mode; a hex
  // `color` is an inline style and would render identically in both themes.
  it("uses a themed variant rather than a hardcoded color", () => {
    expect(orgIconTile(ProductTierType.Enterprise).color).toBeUndefined();
  });
});

describe("navIconTile", () => {
  const navItem = (
    type: VaultNavItemType,
    icon: BitwardenIcon,
    color?: string,
  ): VaultNavItemViewModel => ({ id: "1", label: "Vault", type, color, icon });

  // Org tiles derive their color from `type` alone, so the view model carries no color for them.
  it("gives a family org the teal variant", () => {
    expect(navIconTile(navItem(VaultNavItemType.Family, "bwi-family"))).toEqual({
      icon: "bwi-family",
      variant: "teal",
      emphasis: "bold",
    });
  });

  it("gives a business org the purple variant", () => {
    expect(navIconTile(navItem(VaultNavItemType.Organization, "bwi-business"))).toEqual({
      icon: "bwi-business",
      variant: "purple",
      emphasis: "bold",
    });
  });

  it("keeps the personal entry on its avatar-matched hex", () => {
    expect(navIconTile(navItem(VaultNavItemType.Personal, "bwi-user", "#abcdef"))).toEqual({
      icon: "bwi-user",
      color: "#abcdef",
    });
  });
});

describe("personalIconTile", () => {
  it("tints the user icon with a palette avatar color", () => {
    expect(personalIconTile("purple")).toEqual({ icon: "bwi-user", color: "#8200db" });
  });

  it("tints the user icon with a custom avatar hex", () => {
    expect(personalIconTile("#123456")).toEqual({ icon: "bwi-user", color: "#123456" });
  });
});

describe("vaultScopeHeaderTile", () => {
  const personalNav: VaultsNavViewModel = {
    vaults: [
      {
        id: "user-1",
        label: "My vault",
        type: VaultNavItemType.Personal,
        color: "#abcdef",
        icon: "bwi-user",
      },
    ],
    organizationDataOwnership: false,
  };

  it("gives All items the brand list tile", () => {
    expect(vaultScopeHeaderTile({ type: VaultScopeType.AllItems }, personalNav)).toEqual(
      ALL_ITEMS_ICON_TILE,
    );
  });

  it("gives My vault the personal tile from the nav", () => {
    expect(vaultScopeHeaderTile({ type: VaultScopeType.MyVault }, personalNav)).toEqual({
      icon: "bwi-user",
      color: "#abcdef",
    });
  });

  it("has no tile until the nav loads", () => {
    expect(vaultScopeHeaderTile({ type: VaultScopeType.MyVault }, undefined)).toBeUndefined();
  });

  // Organization vaults carry their tile on the breadcrumb trail's root crumb instead.
  it("has no tile for an organization vault, trash, or archive", () => {
    const orgId = "1b2c3d4e-5f60-4a1b-8c2d-3e4f5a6b7c8d" as OrganizationId;
    expect(
      vaultScopeHeaderTile(
        { type: VaultScopeType.Organization, organizationId: orgId },
        personalNav,
      ),
    ).toBeUndefined();
    expect(vaultScopeHeaderTile({ type: VaultScopeType.Trash }, personalNav)).toBeUndefined();
    expect(vaultScopeHeaderTile({ type: VaultScopeType.Archive }, personalNav)).toBeUndefined();
  });
});
