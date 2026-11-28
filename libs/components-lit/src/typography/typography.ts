import { css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { html, literal, StaticValue } from "lit/static-html.js";

import { BitElement } from "../core/bit-element";

export type TypographyVariant =
  "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "body1" | "body2" | "helper";

export type TypographyElement = "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p" | "span" | "div";

const styles: Record<TypographyVariant, string> = {
  h1: "!tw-text-3xl tw-text-main tw-font-medium",
  h2: "!tw-text-2xl tw-text-main tw-font-medium",
  h3: "!tw-text-xl tw-text-main tw-font-medium",
  h4: "!tw-text-lg tw-text-main tw-font-medium",
  h5: "!tw-text-base tw-text-main tw-font-medium",
  h6: "!tw-text-sm tw-text-main tw-font-medium",
  body1: "!tw-text-base",
  body2: "!tw-text-sm",
  helper: "!tw-text-xs",
};

const margins: Record<TypographyVariant, string> = {
  h1: "tw-mb-2",
  h2: "tw-mb-2",
  h3: "tw-mb-2",
  h4: "tw-mb-2",
  h5: "tw-mb-1.5",
  h6: "tw-mb-1.5",
  body1: "",
  body2: "",
  helper: "",
};

/**
 * Class string for a typography variant, for elements inside other Lit templates (which share
 * this library's stylesheet) or pages with the Bitwarden Tailwind build.
 *
 * ```ts
 * html`<h2 class=${typography("h5")}>Semantically h2, styled as h5</h2>`
 * ```
 */
export function typography(
  variant: TypographyVariant,
  { noMargin = false }: { noMargin?: boolean } = {},
): string {
  return `${styles[variant]} ${noMargin ? "" : margins[variant]}`.trim();
}

const tags: Record<TypographyElement, StaticValue> = {
  h1: literal`h1`,
  h2: literal`h2`,
  h3: literal`h3`,
  h4: literal`h4`,
  h5: literal`h5`,
  h6: literal`h6`,
  p: literal`p`,
  span: literal`span`,
  div: literal`div`,
};

const defaultElement: Record<TypographyVariant, TypographyElement> = {
  h1: "h1",
  h2: "h2",
  h3: "h3",
  h4: "h4",
  h5: "h5",
  h6: "h6",
  body1: "p",
  body2: "p",
  helper: "p",
};

/**
 * Text in one of the design system's type styles. Renders a heading for heading variants and a
 * paragraph otherwise; set `as` when the semantic element and the style differ.
 *
 * Classes on the host that inherit (weight, decoration, font family) apply to the text.
 *
 * @slot - Text
 * @csspart base - The rendered element.
 */
@customElement("bit-typography")
export class BitTypography extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: block;
      }
      :host([as="span"]) {
        display: inline;
      }
    `,
  ];

  @property({ reflect: true }) variant: TypographyVariant = "body1";

  /** The element to render. Defaults to the variant's heading level, or `p`. */
  @property({ reflect: true }) as?: TypographyElement;

  /** Omit the heading variants' bottom margin. */
  @property({ type: Boolean, attribute: "no-margin" }) noMargin = false;

  render() {
    const tag = tags[this.as ?? defaultElement[this.variant] ?? "p"] ?? tags.p;
    return html`<${tag} part="base" class=${typography(this.variant, { noMargin: this.noMargin })}
      ><slot></slot
    ></${tag}>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-typography": BitTypography;
  }
}
