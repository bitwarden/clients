import { css, html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";

import { BitElement } from "../core/bit-element";

import { LANDING_CONTENT_VERTICAL_PADDING_DEFAULT } from "./landing-defaults";
import { SlotByTagController } from "./slot-by-tag";

export const LandingContentMaxWidth = ["md", "lg", "xl", "2xl", "3xl", "4xl"] as const;

export type LandingContentMaxWidthType = (typeof LandingContentMaxWidth)[number];

export type ContentVerticalPaddingType = "compact" | "default";

const maxWidthClass: Record<LandingContentMaxWidthType, string> = {
  md: "tw-max-w-md",
  lg: "tw-max-w-lg",
  xl: "tw-max-w-xl",
  "2xl": "tw-max-w-2xl",
  "3xl": "tw-max-w-3xl",
  "4xl": "tw-max-w-4xl",
};

/**
 * Main content container for landing pages with a configurable max width. A `bit-landing-hero`
 * child always renders first.
 *
 * @slot - Page content, typically a `bit-landing-hero` and a `bit-landing-card`
 */
@customElement("bit-landing-content")
export class BitLandingContent extends BitElement {
  static shadowRootOptions: ShadowRootInit = {
    ...LitElement.shadowRootOptions,
    slotAssignment: "manual",
  };

  static styles = [
    BitElement.styles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        flex-grow: 1;
      }
    `,
  ];

  /** Max width of the content column. */
  @property({ attribute: "max-width" }) maxWidth: LandingContentMaxWidthType = "md";

  /** Vertical padding of the content area. "compact" reduces it. */
  @property({ attribute: "content-vertical-padding" })
  contentVerticalPadding: ContentVerticalPaddingType = LANDING_CONTENT_VERTICAL_PADDING_DEFAULT;

  constructor() {
    super();
    new SlotByTagController(this, { hero: "bit-landing-hero" });
  }

  render() {
    return html`<div
      class="tw-flex tw-flex-col tw-flex-1 tw-items-center tw-bg-background-alt tw-p-5 tw-text-main ${
        this.contentVerticalPadding === "compact" ? "tw-py-3" : "tw-pt-12"
      }"
    >
      <div class="tw-flex tw-flex-col tw-w-full ${maxWidthClass[this.maxWidth]}">
        <slot name="hero"></slot>
        <slot></slot>
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-landing-content": BitLandingContent;
  }
}
