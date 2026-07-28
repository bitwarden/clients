import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

import { Utils } from "@bitwarden/common/platform/misc/utils";

import { BitwardenIcon } from "../shared/icon";

type SemanticVariant =
  "primary" | "success" | "danger" | "warning" | "subtle" | "dark" | "contrast";
type DecorativeVariant = "brand" | "teal" | "green" | "orange" | "red" | "purple" | "gray";

export type IconTileVariant = SemanticVariant | DecorativeVariant;

export type IconTileEmphasis = "muted" | "bold";

export type IconTileSize = "xs" | "sm" | "base" | "lg" | "xl";

/** The [background, border, foreground] Tailwind class triple for one tile appearance. */
type TileClasses = string[];

/** A variant's classes for each emphasis level. */
type EmphasisStyles = Record<IconTileEmphasis, TileClasses>;

// Decorative color families are the single source of truth for the categorical palette.
const decorativeVariantStyles: Record<DecorativeVariant, EmphasisStyles> = {
  brand: {
    muted: [
      "tw-bg-bg-decorative-brand",
      "tw-border-border-decorative-brand",
      "tw-text-fg-decorative-brand",
    ],
    bold: [
      "tw-bg-bg-decorative-brand-bold",
      "tw-border-border-decorative-brand-bold",
      "tw-text-fg-decorative-brand-bold",
    ],
  },
  teal: {
    muted: [
      "tw-bg-bg-decorative-teal",
      "tw-border-border-decorative-teal",
      "tw-text-fg-decorative-teal",
    ],
    bold: [
      "tw-bg-bg-decorative-teal-bold",
      "tw-border-border-decorative-teal-bold",
      "tw-text-fg-decorative-teal-bold",
    ],
  },
  green: {
    muted: [
      "tw-bg-bg-decorative-green",
      "tw-border-border-decorative-green",
      "tw-text-fg-decorative-green",
    ],
    bold: [
      "tw-bg-bg-decorative-green-bold",
      "tw-border-border-decorative-green-bold",
      "tw-text-fg-decorative-green-bold",
    ],
  },
  orange: {
    muted: [
      "tw-bg-bg-decorative-orange",
      "tw-border-border-decorative-orange",
      "tw-text-fg-decorative-orange",
    ],
    bold: [
      "tw-bg-bg-decorative-orange-bold",
      "tw-border-border-decorative-orange-bold",
      "tw-text-fg-decorative-orange-bold",
    ],
  },
  red: {
    muted: [
      "tw-bg-bg-decorative-red",
      "tw-border-border-decorative-red",
      "tw-text-fg-decorative-red",
    ],
    bold: [
      "tw-bg-bg-decorative-red-bold",
      "tw-border-border-decorative-red-bold",
      "tw-text-fg-decorative-red-bold",
    ],
  },
  purple: {
    muted: [
      "tw-bg-bg-decorative-purple",
      "tw-border-border-decorative-purple",
      "tw-text-fg-decorative-purple",
    ],
    bold: [
      "tw-bg-bg-decorative-purple-bold",
      "tw-border-border-decorative-purple-bold",
      "tw-text-fg-decorative-purple-bold",
    ],
  },
  gray: {
    muted: [
      "tw-bg-bg-decorative-gray",
      "tw-border-border-decorative-gray",
      "tw-text-fg-decorative-gray",
    ],
    bold: [
      "tw-bg-bg-decorative-gray-bold",
      "tw-border-border-decorative-gray-bold",
      "tw-text-fg-decorative-gray-bold",
    ],
  },
};

// Semantic variants ignore emphasis — map both emphases to the same triple.
const emphasisAgnostic = (classes: TileClasses): EmphasisStyles => ({
  muted: classes,
  bold: classes,
});

const variantStyles: Record<IconTileVariant, EmphasisStyles> = {
  // decorative families respond to emphasis
  brand: decorativeVariantStyles.brand,
  teal: decorativeVariantStyles.teal,
  green: decorativeVariantStyles.green,
  orange: decorativeVariantStyles.orange,
  red: decorativeVariantStyles.red,
  purple: decorativeVariantStyles.purple,
  gray: decorativeVariantStyles.gray,
  // overlapping semantic variants delegate to the decorative muted triple so they render identically
  primary: emphasisAgnostic(decorativeVariantStyles.brand.muted),
  success: emphasisAgnostic(decorativeVariantStyles.green.muted),
  danger: emphasisAgnostic(decorativeVariantStyles.red.muted),
  warning: emphasisAgnostic(decorativeVariantStyles.orange.muted),
  // no decorative equivalent — keep existing styles
  subtle: emphasisAgnostic(["tw-bg-bg-quaternary", "tw-border-border-base", "tw-text-fg-body"]),
  dark: emphasisAgnostic(["tw-bg-bg-contrast", "tw-border-border-strong", "tw-text-fg-contrast"]),
  contrast: emphasisAgnostic(["tw-bg-bg-primary", "tw-border-border-base", "tw-text-fg-heading"]),
};

const sizeStyles: Record<IconTileSize, { container: string[]; icon: string[] }> = {
  xs: {
    container: ["tw-size-4"],
    icon: ["tw-text-[.625rem]", "tw-leading-[0]"],
  },
  sm: {
    container: ["tw-size-6"],
    icon: ["tw-text-base", "tw-leading-[0]"],
  },
  base: {
    container: ["tw-size-8"],
    icon: ["tw-text-xl"],
  },
  lg: {
    container: ["tw-size-12"],
    icon: ["tw-text-[1.75rem]"],
  },
  xl: {
    container: ["tw-size-16"],
    icon: ["tw-text-4xl"],
  },
};

const borderRadius: Record<IconTileSize, string[]> = {
  xs: ["tw-rounded"],
  sm: ["tw-rounded"],
  base: ["tw-rounded-lg"],
  lg: ["tw-rounded-lg"],
  xl: ["tw-rounded-xl"],
};

/**
 * Icon tiles are static containers that display an icon with a colored background.
 * They are similar to icon buttons but are not interactive and are used for visual
 * indicators, status representations, or decorative elements.
 *
 * Use icon tiles to:
 * - Display status or category indicators
 * - Represent different types of content
 * - Create visual hierarchy in lists or cards
 * - Show app or service icons in a consistent format
 */
@Component({
  selector: "bit-icon-tile",
  templateUrl: "icon-tile.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IconTileComponent {
  /**
   * The BWI icon name
   */
  readonly icon = input.required<BitwardenIcon>();

  /**
   * The visual theme of the icon tile
   */
  readonly variant = input<IconTileVariant>("primary");

  /**
   * Optional custom hex color (e.g. `#175ddc`) — typically used to match a user's avatar color.
   * When set, it takes precedence over `variant`/`emphasis`: the fill matches the color, the
   * foreground (icon) color is chosen for contrast, and the border is the color adjusted ±15%
   * lightness.
   */
  readonly color = input<string>();

  /**
   * Emphasis level for the decorative color families (`brand`, `teal`, `green`, `orange`, `red`,
   * `purple`, `gray`). Ignored by the semantic variants, which render the same regardless.
   */
  readonly emphasis = input<IconTileEmphasis>("muted");

  /**
   * The size of the icon tile
   */
  readonly size = input<IconTileSize>("base");

  /**
   * Optional aria-label for accessibility when the icon has semantic meaning
   */
  readonly ariaLabel = input<string>();

  /**
   * When a custom `color` is provided, derive the fill, border, and foreground colors. Mirrors the
   * avatar component's custom-color logic so icon tiles and avatars render matching colors.
   * Returns `null` when no custom color is set, in which case the `variant`/`emphasis` classes apply.
   */
  protected readonly customColorStyles = computed<{
    background: string;
    border: string;
    text: string;
  } | null>(() => {
    const color = this.color();
    if (color == null || color.trim() === "") {
      return null;
    }

    // "black" or "white" — svgTextFill omits `!important` so the value is valid in a style binding.
    const text = Utils.pickTextColorBasedOnBgColor(color, 135, true);
    // Dark foreground -> darken the border 15%; white foreground -> lighten the border 15%.
    const borderLightness = text === "black" ? "calc(l - 15)" : "calc(l + 15)";

    return {
      background: color,
      border: `hsl(from ${color} h s ${borderLightness})`,
      text,
    };
  });

  protected readonly containerClasses = computed(() => {
    const size = this.size();
    // A custom color supplies bg/border/text via inline styles, so drop the variant color triple.
    const colorClasses = this.customColorStyles()
      ? []
      : variantStyles[this.variant()][this.emphasis()];

    return [
      "tw-inline-flex",
      "tw-items-center",
      "tw-justify-center",
      "tw-flex-shrink-0",
      "tw-border",
      ...colorClasses,
      ...sizeStyles[size].container,
      ...borderRadius[size],
    ];
  });

  protected readonly iconClasses = computed(() => {
    const size = this.size();

    return ["bwi", this.icon(), ...sizeStyles[size].icon];
  });
}
