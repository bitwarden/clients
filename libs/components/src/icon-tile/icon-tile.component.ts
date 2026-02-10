import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

import { BitwardenIcon } from "../shared/icon";

export type IconTileVariant =
  | "primary"
  | "success"
  | "danger"
  | "warning"
  | "subtle"
  | "dark"
  | "contrast";

export type IconTileSize = "xs" | "sm" | "base" | "lg" | "xl";

const variantStyles: Record<IconTileVariant, string[]> = {
  primary: ["tw-bg-bg-brand-soft", "tw-border-border-brand-soft", "tw-text-fg-brand"],
  success: ["tw-bg-bg-success-medium", "tw-border-border-success-soft", "tw-text-fg-success"],
  danger: ["tw-bg-bg-danger-medium", "tw-border-border-danger-soft", "tw-text-fg-danger"],
  warning: ["tw-bg-bg-warning-medium", "tw-border-border-warning-soft", "tw-text-fg-warning"],
  subtle: ["tw-bg-bg-quaternary", "tw-border-border-base", "tw-text-fg-body"],
  dark: ["tw-bg-bg-contrast", "tw-border-border-strong", "tw-text-fg-contrast"],
  contrast: ["tw-bg-bg-primary", "tw-border-border-base", "tw-text-fg-dark"],
};

const sizeStyles: Record<IconTileSize, { container: string[]; icon: string[] }> = {
  xs: {
    container: ["tw-w-4", "tw-h-4"],
    icon: ["tw-text-xs", "tw-leading-[0]"],
  },
  sm: {
    container: ["tw-w-6", "tw-h-6"],
    icon: ["tw-text-sm", "tw-leading-[0]"],
  },
  base: {
    container: ["tw-w-9", "tw-h-9"],
    icon: ["tw-text-lg"],
  },
  lg: {
    container: ["tw-w-12", "tw-h-12"],
    icon: ["tw-text-2xl"],
  },
  xl: {
    container: ["tw-w-16", "tw-h-16"],
    icon: ["tw-text-3xl"],
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
   * The size of the icon tile
   */
  readonly size = input<IconTileSize>("base");

  /**
   * Optional aria-label for accessibility when the icon has semantic meaning
   */
  readonly ariaLabel = input<string>();

  protected readonly containerClasses = computed(() => {
    const variant = this.variant();
    const size = this.size();

    return [
      "tw-inline-flex",
      "tw-items-center",
      "tw-justify-center",
      "tw-flex-shrink-0",
      "tw-border",
      ...variantStyles[variant],
      ...sizeStyles[size].container,
      ...borderRadius[size],
    ];
  });

  protected readonly iconClasses = computed(() => {
    const size = this.size();

    return ["bwi", this.icon(), ...sizeStyles[size].icon];
  });
}
