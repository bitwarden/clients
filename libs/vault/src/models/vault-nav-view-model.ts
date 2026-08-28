import { CollectionId } from "@bitwarden/common/types/guid";
import { AvatarColor, BitwardenIcon } from "@bitwarden/components";

export const VaultNavItemType = Object.freeze({
  Personal: "personal",
  Organization: "organization",
  Family: "family",
} as const);
export type VaultNavItemType = (typeof VaultNavItemType)[keyof typeof VaultNavItemType];

/**
 * A default avatar palette color, or a user-selected custom hex color. Mirrors AvatarComponent's
 * `color` input so nav tiles render the same color the user sees on their avatar.
 */
export type VaultNavColor = AvatarColor | string;

export interface VaultNavItemViewModel {
  /** Stable identifier: userId for the personal vault; org.id for org vaults. */
  id: string;
  /** Already i18n-resolved display label. */
  label: string;
  color: VaultNavColor;
  icon: BitwardenIcon;
  type: VaultNavItemType;
  /** The org's default user collection ("My items"); set only on org items under data ownership. */
  defaultUserCollectionId?: CollectionId;
}

export interface VaultsNavViewModel {
  /**
   * Ordered vault items: personal vault first, then orgs alphabetically; personal is omitted under
   * `organizationDataOwnership`. Presentation: "All items" when `length > 1`; "Vaults" header when
   * `length > 1 && !organizationDataOwnership`; the personal vault renders as a plain item, orgs as
   * groups.
   */
  vaults: readonly VaultNavItemViewModel[];

  /**
   * True when the OrganizationDataOwnership policy applies and `vaults` holds at least one org. The
   * org section starts expanded and renders a "My items" group within it.
   */
  organizationDataOwnership: boolean;
}
