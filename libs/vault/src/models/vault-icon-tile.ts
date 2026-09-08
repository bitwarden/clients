import { ProductTierType } from "@bitwarden/common/billing/enums";
import {
  defaultAvatarColors,
  IconTileOptions,
  IconTileVariant,
  isAvatarColor,
} from "@bitwarden/components";

import { getOrgIconForTier } from "../components/org-icon.directive";

import { VaultNavColor, VaultNavItemType, VaultNavItemViewModel } from "./vault-nav-view-model";

/**
 * The tile variant for an organization, keyed off its plan: Free and Families orgs read as personal
 * spaces and share the `teal` tile, everything else is a business vault on `purple`.
 *
 * The same mapping backs every surface a vault appears on — the side nav, the item table's Vault
 * column, and the item form's vault selector — so a vault's tile is the same color throughout.
 */
function orgTileVariant(tier: ProductTierType): IconTileVariant {
  const family = tier === ProductTierType.Free || tier === ProductTierType.Families;
  return familyTileVariant(family);
}

/** The variant for an organization tile, given whether its plan reads as a family space. */
function familyTileVariant(family: boolean): IconTileVariant {
  return family ? "teal" : "purple";
}

/**
 * Resolves a {@link VaultNavColor} to a hex value the icon tile can render.
 *
 * Only the personal vault needs this: its tile matches the user's avatar, and that color can be any
 * hex they picked in the change-avatar dialog, so there is no theme token or tile variant to name.
 * Organization tiles have a fixed palette and go through `variant` instead — see
 * {@link orgIconTile}.
 */
export function vaultTileColor(color: VaultNavColor): string {
  return isAvatarColor(color) ? defaultAvatarColors[color] : color;
}

/**
 * The icon tile for a vault-owning organization: a tier-appropriate icon on the tier's color.
 *
 * Uses `variant`/`emphasis` rather than a hex `color` so the tile resolves through the decorative
 * theme tokens and adapts to light and dark mode. `bold` is the emphasis whose light-mode tokens
 * match the palette values these tiles rendered as before.
 *
 * Returns a new object per call. Callers that feed a template binding must hold the result in a
 * `computed`/`signal` rather than calling this from the template — see {@link personalIconTile}.
 */
export function orgIconTile(tier: ProductTierType): IconTileOptions {
  return {
    icon: getOrgIconForTier(tier),
    variant: orgTileVariant(tier),
    emphasis: "bold",
  };
}

/**
 * The icon tile for the user's own vault, tinted to match their avatar so the two read as the same
 * identity.
 *
 * Unlike {@link orgIconTile} this uses a hex `color`, so it does not adapt to light and dark mode:
 * the avatar color is user-chosen and has no theme token behind it. Theming it would mean moving
 * avatar colors onto the `--color-bg-avatar-*` tokens, which changes avatars app-wide.
 *
 * Returns a new object per call. Bind the result through a `computed` rather than calling this
 * directly from a template: `bit-select` maps its options inside an `afterRenderEffect` that both
 * reads `iconTile` and writes the mapped array, so a fresh object each render re-triggers that
 * effect indefinitely and hangs change detection.
 *
 * @param avatarColor The user's avatar color, palette name or custom hex. When omitted the tile
 * renders untinted; callers that have a user should resolve the avatar default rather than rely on
 * that, since the nav always has one.
 */
export function personalIconTile(avatarColor?: VaultNavColor): IconTileOptions {
  return {
    icon: "bwi-user",
    color: avatarColor === undefined ? undefined : vaultTileColor(avatarColor),
  };
}

/**
 * The icon tile for a side-nav vault entry, whose view model already carries the resolved
 * {@link VaultNavItemType} rather than a raw product tier.
 *
 * Only the personal entry reads `color`; org tiles resolve their variant from `type`, so
 * {@link VaultNavItemViewModel.color} is the single source of truth for exactly the one vault that
 * has a user-chosen color and is left unset elsewhere.
 */
export function navIconTile(vault: VaultNavItemViewModel): IconTileOptions {
  if (vault.type === VaultNavItemType.Personal) {
    return personalIconTile(vault.color);
  }
  return {
    icon: vault.icon,
    variant: familyTileVariant(vault.type === VaultNavItemType.Family),
    emphasis: "bold",
  };
}
