import { css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";

import { pickTextColor } from "../avatar/avatar-color";
import { BitElement } from "../core/bit-element";
import "../icon/icon";
import { BitwardenIcon } from "../icon/shared-icon";

import {
  DecorativeColors,
  DecorativeEmphasis,
  DecorativeVariant,
  decorativeColors,
} from "./decorative-colors";

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

const sizeStyles: Record<IconTileSize, { container: string; icon: string }> = {
  xs: { container: "tw-size-4 tw-rounded", icon: "tw-text-[.625rem] tw-leading-[0]" },
  sm: { container: "tw-size-6 tw-rounded", icon: "tw-text-base tw-leading-[0]" },
  base: { container: "tw-size-8 tw-rounded-lg", icon: "tw-text-xl" },
  lg: { container: "tw-size-12 tw-rounded-lg", icon: "tw-text-[1.75rem]" },
  xl: { container: "tw-size-16 tw-rounded-xl", icon: "tw-text-4xl" },
};

/**
 * A static container displaying an icon on a colored background. Use for status or category
 * indicators, content types, or app/service icons. Not interactive.
 *
 * Decorative unless `label` is set, in which case it's exposed as an image.
 */
@customElement("bit-icon-tile")
export class BitIconTile extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: inline-flex;
      }
    `,
  ];

  private readonly internals = this.attachInternals();

  /** The BWI icon name. */
  @property({ reflect: true }) icon!: BitwardenIcon;

  @property({ reflect: true }) variant: IconTileVariant = "primary";

  /**
   * Custom hex color (e.g. `#175ddc`), typically to match a user's avatar color. Overrides
   * `variant`/`emphasis`: the fill matches the color, the icon color is chosen for contrast, and
   * the border is the color adjusted ±15% lightness.
   */
  @property() color?: string;

  /** Emphasis for the decorative color families. Ignored by the semantic variants. */
  @property() emphasis: IconTileEmphasis = "subtle";

  @property({ reflect: true }) size: IconTileSize = "base";

  /** Accessible label, for tiles that convey meaning (status, category). */
  @property() label?: string;

  protected willUpdate() {
    this.internals.role = this.label ? "img" : null;
    this.internals.ariaLabel = this.label || null;
  }

  private get colorStyles(): DecorativeColors {
    const custom = this.color?.trim();
    if (custom) {
      const text = pickTextColor(custom, 135);
      // Dark foreground -> darken the border 15%; white foreground -> lighten the border 15%.
      const borderLightness = text === "black" ? "calc(l - 15)" : "calc(l + 15)";
      return { background: custom, border: `hsl(from ${custom} h s ${borderLightness})`, text };
    }
    const unique = uniqueVariantColors[this.variant];
    if (unique) {
      return unique;
    }
    const alias = decorativeAliases[this.variant];
    if (alias) {
      // Semantic variants ignore emphasis — always render the subtle triple.
      return decorativeColors(alias, "subtle");
    }
    return decorativeColors(this.variant as DecorativeVariant, this.emphasis);
  }

  render() {
    const size = sizeStyles[this.size] ?? sizeStyles.base;
    const colors = this.colorStyles;
    return html`<div
      part="base"
      class="tw-inline-flex tw-items-center tw-justify-center tw-flex-shrink-0 tw-border tw-border-solid ${size.container}"
      style=${styleMap({
        "background-color": colors.background,
        "border-color": colors.border,
        color: colors.text,
      })}
    >
      <bit-icon name=${this.icon} class=${size.icon}></bit-icon>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-icon-tile": BitIconTile;
  }
}
