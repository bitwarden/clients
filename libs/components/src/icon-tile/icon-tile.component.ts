import { ChangeDetectionStrategy, Component, computed, input, model } from "@angular/core";

import { Utils } from "@bitwarden/common/platform/misc/utils";

import {
  DecorativeColors,
  DecorativeEmphasis,
  DecorativeVariant,
  decorativeColors,
} from "../shared/decorative-colors";
import { BitwardenIcon } from "../shared/icon";

type SemanticVariant = "primary" | "success" | "danger" | "warning" | "dark";

export type IconTileVariant = SemanticVariant | DecorativeVariant;

export type IconTileEmphasis = DecorativeEmphasis;

export type IconTileSize = "xs" | "sm" | "base" | "lg" | "xl";

// Semantic variants that render identically to a decorative family, always at subtle emphasis.
const decorativeAliases: Partial<Record<IconTileVariant, DecorativeVariant>> = {
  primary: "brand",
  success: "green",
  danger: "red",
  warning: "orange",
};

// Semantic variants with no decorative equivalent; unaffected by emphasis.
const uniqueVariantColors: Partial<Record<IconTileVariant, DecorativeColors>> = {
  dark: {
    background: "var(--color-bg-contrast)",
    border: "var(--color-border-strong)",
    text: "var(--color-fg-contrast)",
  },
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
  host: {
    class: "tw-inline-flex",
  },
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
  readonly emphasis = input<IconTileEmphasis>("subtle");

  /**
   * The size of the icon tile.
   *
   * Exposed as a `model` so a parent that renders a projected tile (e.g. `bit-breadcrumb`)
   * can drive the size programmatically while consumers can still bind it declaratively.
   */
  readonly size = model<IconTileSize>("base");

  /**
   * Optional aria-label for accessibility when the icon has semantic meaning
   */
  readonly ariaLabel = input<string>();

  /** The background, border, and foreground colors applied to the tile as inline styles. */
  protected readonly colorStyles = computed<DecorativeColors>(() => {
    const custom = this.color()?.trim();
    if (custom) {
      // "black" or "white" — svgTextFill omits `!important` so the value is valid in a style binding.
      const text = Utils.pickTextColorBasedOnBgColor(custom, 135, true);
      // Dark foreground -> darken the border 15%; white foreground -> lighten the border 15%.
      const borderLightness = text === "black" ? "calc(l - 15)" : "calc(l + 15)";
      return {
        background: custom,
        border: `hsl(from ${custom} h s ${borderLightness})`,
        text,
      };
    }

    const variant = this.variant();
    const unique = uniqueVariantColors[variant];
    if (unique) {
      return unique;
    }

    const alias = decorativeAliases[variant];
    if (alias) {
      // Semantic variants ignore emphasis — always render the subtle triple.
      return decorativeColors(alias, "subtle");
    }

    return decorativeColors(variant as DecorativeVariant, this.emphasis());
  });

  protected readonly containerClasses = computed(() => {
    const size = this.size();

    return [
      "tw-inline-flex",
      "tw-items-center",
      "tw-justify-center",
      "tw-flex-shrink-0",
      "tw-border",
      ...sizeStyles[size].container,
      ...borderRadius[size],
    ];
  });

  protected readonly iconClasses = computed(() => {
    const size = this.size();

    return ["bwi", this.icon(), ...sizeStyles[size].icon];
  });
}
