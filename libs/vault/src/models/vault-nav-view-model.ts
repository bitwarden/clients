import { AvatarDefaultColor } from "@bitwarden/components";

export const VaultNavItemType = Object.freeze({
  Personal: "personal",
  Organization: "organization",
  Family: "family",
  AllItems: "all-items",
} as const);
export type VaultNavItemType = (typeof VaultNavItemType)[keyof typeof VaultNavItemType];

/**
 * A default avatar palette color, or a user-selected custom hex color. Mirrors AvatarComponent's
 * `color` input so nav tiles render the same color the user sees on their avatar.
 */
export type VaultNavColor = AvatarDefaultColor | string;

export interface VaultNavItemViewModel {
  /** Stable identifier: userId for personal; org.id for org vaults; "all-items" sentinel. */
  id: string;
  /** Already i18n-resolved display label. */
  label: string;
  color: VaultNavColor;
  type: VaultNavItemType;
}

export interface VaultsNavViewModel {
  /** True when the "Vaults" section header should be rendered. */
  showVaultsHeader: boolean;

  /**
   * Ordered vault items. Populated when the user has org memberships; personal vault is always
   * first, org vaults follow alphabetically by name.
   */
  vaults: readonly VaultNavItemViewModel[];

  /**
   * Non-null when the user has no org memberships and is on a free plan.
   * The nav renders "My vault" as a plain top-level item (no section header).
   */
  myVaultItem: VaultNavItemViewModel | null;

  /**
   * Non-null when the user has no org memberships and has premium from any source.
   * The nav renders "All items" as the top-level item (no section header).
   */
  allItemsItem: VaultNavItemViewModel | null;

  /**
   * True when the OrganizationDataOwnership policy is active. The org section should default to
   * expanded rather than collapsed.
   */
  orgDefaultExpanded: boolean;

  /**
   * True when the OrganizationDataOwnership policy is active. The nav should render a
   * "My items" group within the org section.
   */
  showMyItemsGroup: boolean;
}
