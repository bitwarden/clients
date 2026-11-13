import { css, html, nothing, PropertyValues } from "lit";
import { customElement, property, query } from "lit/decorators.js";

import { AriaTargetHost } from "../core/aria";
import { BitElement } from "../core/bit-element";
import type { BitwardenIcon } from "../icon/shared-icon";
import type { BitIconTile } from "../icon-tile/icon-tile";
import { typography } from "../typography/typography";
import "../icon/icon";

export type BreadcrumbSize = "small" | "base";

/** @internal Fired when a crumb property the parent renders from changes. */
export const BREADCRUMB_CHANGE_EVENT = "bit-breadcrumb-change";

const baseStyles = [
  "tw-inline-block",
  "tw-min-w-0",
  "!tw-m-0",
  "tw-rounded",
  "focus-visible:!tw-text-fg-brand",
  "focus-visible:tw-outline-none",
  "focus-visible:tw-ring-2",
  "focus-visible:tw-ring-border-focus",
];

const breadcrumbStyles = [
  ...baseStyles,
  "tw-bg-transparent",
  "tw-border-none",
  "tw-p-0",
  "tw-cursor-pointer",
  "tw-no-underline",
  "!tw-text-fg-body",
  "hover:!tw-text-fg-brand",
].join(" ");

const activeBreadcrumbStyles = [...baseStyles, "!tw-text-fg-heading"].join(" ");

/** The separator arrow between crumbs, shared with `bit-breadcrumbs`. */
export function breadcrumbArrow(size: BreadcrumbSize) {
  return html`<bit-icon
    name="bwi-angle-right"
    class="tw-shrink-0 tw-text-fg-body ${size === "small" ? "tw-text-md tw-mx-2" : "tw-text-xl tw-mx-3"}"
  ></bit-icon>`;
}

/**
 * A single step in a `bit-breadcrumbs` trail. Renders a link when `href` is set, otherwise a
 * button (listen for `click`). The `current` crumb renders as static text with
 * `aria-current="page"`.
 *
 * @slot - Label.
 * @slot start - Leading visual, e.g. a `bit-icon-tile`. A slotted tile is sized with the trail.
 */
@customElement("bit-breadcrumb")
export class BitBreadcrumb extends BitElement implements AriaTargetHost {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: flex;
        align-items: center;
        flex-shrink: 0;
      }
      :host([data-overflow-shrink]) {
        flex-shrink: 1;
        min-width: 0;
      }
    `,
  ];

  /** Icon shown before the label. */
  @property() icon?: BitwardenIcon;

  /** Link target. Without it the crumb is a button. */
  @property() href?: string;

  /** Marks the crumb as the current page: static text with `aria-current="page"`. */
  @property({ type: Boolean, reflect: true }) current = false;

  /** @internal Set by `bit-breadcrumbs`. */
  @property({ attribute: false }) size: BreadcrumbSize = "base";

  /** @internal Set by `bit-breadcrumbs`: render the leading separator. */
  @property({ attribute: false }) separator = false;

  /** @internal Set by `bit-breadcrumbs`: render the current crumb as the page `<h1>`. */
  @property({ attribute: false }) heading = false;

  @query("[data-crumb]") private crumbEl?: HTMLElement;

  private forwarding = false;

  get ariaTarget(): HTMLElement | null {
    return this.crumbEl ?? null;
  }

  /** The label text, for rendering the crumb elsewhere (the overflow menu). */
  get label(): string {
    return Array.from(this.childNodes)
      .filter((node) => !(node instanceof Element && node.hasAttribute("slot")))
      .map((node) => node.textContent ?? "")
      .join("")
      .trim();
  }

  /** Elements slotted into `start`. */
  get startElements(): Element[] {
    return Array.from(this.children).filter((el) => el.getAttribute("slot") === "start");
  }

  constructor() {
    super();
    // Only clicks on the crumb itself count; not on the separator or surrounding space.
    this.addEventListener(
      "click",
      (event) => {
        if (!this.forwarding && this.crumbEl && !event.composedPath().includes(this.crumbEl)) {
          event.stopImmediatePropagation();
        }
      },
      { capture: true },
    );
  }

  /** @internal Fires `click` as if the crumb was activated, e.g. from the overflow menu. */
  activate() {
    this.forwarding = true;
    try {
      this.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
    } finally {
      this.forwarding = false;
    }
  }

  protected updated(changed: PropertyValues<this>) {
    if (changed.has("size")) {
      this.syncStartTiles();
    }
    if (changed.has("current") || changed.has("href") || changed.has("icon")) {
      this.dispatchEvent(new Event(BREADCRUMB_CHANGE_EVENT, { bubbles: true, composed: true }));
    }
  }

  private syncStartTiles() {
    for (const el of this.startElements) {
      if (el.localName === "bit-icon-tile") {
        (el as BitIconTile).size = this.size === "small" ? "xs" : "sm";
      }
    }
  }

  render() {
    const variant = this.size === "small" ? "h6" : "h3";
    const type = typography(variant, { noMargin: true });
    const content = html`<div class="tw-flex tw-min-w-0 tw-items-center tw-gap-2">
      <slot name="start" @slotchange=${this.syncStartTiles}></slot>
      ${this.icon ? html`<bit-icon name=${this.icon} class="tw-shrink-0"></bit-icon>` : nothing}
      <span class="tw-min-w-0 tw-truncate"><slot></slot></span>
    </div>`;

    let crumb;
    if (this.current) {
      crumb = this.heading
        ? html`<h1 data-crumb class="${activeBreadcrumbStyles} ${type}" aria-current="page">
            ${content}
          </h1>`
        : html`<span data-crumb class="${activeBreadcrumbStyles} ${type}" aria-current="page">
            ${content}
          </span>`;
    } else if (this.href) {
      crumb = html`<a data-crumb class="${breadcrumbStyles} ${type}" href=${this.href}
        >${content}</a
      >`;
    } else {
      crumb = html`<button data-crumb type="button" class="${breadcrumbStyles} ${type}">
        ${content}
      </button>`;
    }

    return html`${this.separator ? breadcrumbArrow(this.size) : nothing}${crumb}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-breadcrumb": BitBreadcrumb;
  }
}
