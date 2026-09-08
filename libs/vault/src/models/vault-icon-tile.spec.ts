import { ProductTierType } from "@bitwarden/common/billing/enums";
import { BitwardenIcon } from "@bitwarden/components";

import { navIconTile, orgIconTile, personalIconTile, vaultTileColor } from "./vault-icon-tile";
import { VaultNavItemType, VaultNavItemViewModel } from "./vault-nav-view-model";

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
