import { NgClass } from "@angular/common";
import { Component, computed, input } from "@angular/core";

import { BitwardenIcon } from "../shared/icon";

export type IconTileVariant = "primary" | "success" | "warning" | "danger" | "muted";

export type IconTileSize = "small" | "default" | "large";

export type IconTileShape = "square" | "circle";

const variantStyles: Record<IconTileVariant, string[]> = {
  primary: ["tw-bg-primary-100", "tw-text-primary-700"],
  success: ["tw-bg-success-100", "tw-text-success-700"],
  warning: ["tw-bg-warning-100", "tw-text-warning-700"],
  danger: ["tw-bg-danger-100", "tw-text-danger-700"],
  muted: ["tw-bg-secondary-100", "tw-text-secondary-700"],
};

const sizeStyles: Record<IconTileSize, { container: string[]; icon: string[] }> = {
  small: {
    container: ["tw-w-6", "tw-h-6"],
    icon: ["tw-text-sm"],
  },
  default: {
    container: ["tw-w-8", "tw-h-8"],
    icon: ["tw-text-base"],
  },
  large: {
    container: ["tw-w-10", "tw-h-10"],
    icon: ["tw-text-lg"],
  },
};

const shapeStyles: Record<IconTileShape, Record<IconTileSize, string[]>> = {
  square: {
    small: ["tw-rounded"],
    default: ["tw-rounded-md"],
    large: ["tw-rounded-lg"],
  },
  circle: {
    small: ["tw-rounded-full"],
    default: ["tw-rounded-full"],
    large: ["tw-rounded-full"],
  },
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
  imports: [NgClass],
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
  readonly size = input<IconTileSize>("default");

  /**
   * The shape of the icon tile
   */
  readonly shape = input<IconTileShape>("square");

  /**
   * Optional aria-label for accessibility when the icon has semantic meaning
   */
  readonly ariaLabel = input<string>();

  protected readonly containerClasses = computed(() => {
    const variant = this.variant();
    const size = this.size();
    const shape = this.shape();

    return [
      "tw-inline-flex",
      "tw-items-center",
      "tw-justify-center",
      "tw-flex-shrink-0",
      ...variantStyles[variant],
      ...sizeStyles[size].container,
      ...shapeStyles[shape][size],
    ];
  });

  protected readonly iconClasses = computed(() => {
    const size = this.size();

    return ["bwi", this.icon(), ...sizeStyles[size].icon];
  });
}
