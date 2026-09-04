import { ProductTierType } from "@bitwarden/common/billing/enums";
import {
  defaultAvatarColors,
  IconTileOptions,
  IconTileVariant,
  isAvatarColor,
} from "@bitwarden/components";

import { getOrgIconForTier } from "../components/org-icon.directive";

import { VaultNavColor, VaultNavItemType, VaultNavItemViewModel } from "./vault-nav-view-model";

/** The tile variant for an organization, keyed off its plan */
function orgTileVariant(tier: ProductTierType): IconTileVariant {
  const family = tier === ProductTierType.Free || tier === ProductTierType.Families;
  return familyTileVariant(family);
}

/** The variant for an organization tile, given whether its plan reads as a family space. */
function familyTileVariant(family: boolean): IconTileVariant {
  return family ? "teal" : "purple";
}

/** Resolves a {@link VaultNavColor} to a hex value the icon tile can render */
export function vaultTileColor(color: VaultNavColor): string {
  return isAvatarColor(color) ? defaultAvatarColors[color] : color;
}

/** The icon tile for a vault-owning organization: a tier-appropriate icon on the tier's color. */
export function orgIconTile(tier: ProductTierType): IconTileOptions {
  return {
    icon: getOrgIconForTier(tier),
    variant: orgTileVariant(tier),
    emphasis: "bold",
  };
}

/** The icon tile for the user's own vault, tinted to match their avatar so the two read as the same identity */
export function personalIconTile(avatarColor: VaultNavColor): IconTileOptions {
  return {
    icon: "bwi-user",
    color: vaultTileColor(avatarColor),
  };
}

/**
 * The icon tile for a side-nav vault entry, whose view model already carries the resolved
 * {@link VaultNavItemType} rather than a raw product tier.
 */
export function navIconTile(vault: VaultNavItemViewModel): IconTileOptions {
  if (vault.type === VaultNavItemType.Personal) {
    return personalIconTile(vault.color ?? "brand");
  }
  return {
    icon: vault.icon,
    variant: familyTileVariant(vault.type === VaultNavItemType.Family),
    emphasis: "bold",
  };
}
