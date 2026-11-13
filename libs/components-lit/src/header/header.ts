import { ContextConsumer, ContextProvider } from "@lit/context";
import { css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { BitElement } from "../core/bit-element";
import type { BitwardenIcon } from "../icon/shared-icon";
import { onResize } from "../resize-observer/resize-observer";
import { typography } from "../typography/typography";

import { HeaderContext, headerContext } from "./header-context";
import "../icon/icon";

type SlotName = "default" | "breadcrumbs" | "subtitle" | "secondary" | "tabs";

function hasContent(slot: HTMLSlotElement): boolean {
  return slot
    .assignedNodes({ flatten: true })
    .some((node) => node.nodeType === Node.ELEMENT_NODE || !!node.textContent?.trim());
}

/**
 * The header displays a page's title, an optional icon, and the controls and navigation that belong
 * to that page. It renders the page's `<h1>`, so a page should contain exactly one header — unless a
 * slotted breadcrumbs component promotes its active breadcrumb to the heading instead (see
 * `HeaderContext`).
 *
 * @slot - Controls that act on the page, aligned to the end of the title row.
 * @slot breadcrumbs - Breadcrumbs showing where the page sits in the hierarchy.
 * @slot title-prefix - Leading content before the title, e.g. a `bit-icon-tile`. Not rendered in the `legacy` layout.
 * @slot title-suffix - Content appended inline after the visible heading.
 * @slot subtitle - Additional page information. Not rendered in the `legacy` layout.
 * @slot tabs - A tab nav bar for navigation within the page.
 * @slot secondary - **Deprecated.** A second row of controls. Only rendered in the `legacy` layout.
 * @cssprop --bit-header-margin-inline - Inline margin outside `bit-layout`/`bit-page`. Defaults to `2.5rem`.
 */
@customElement("bit-header")
export class BitHeader extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: block;
        container-type: inline-size;
      }
      .standalone {
        margin-inline: var(--bit-header-margin-inline, 2.5rem);
      }
    `,
  ];

  /** The title of the page. */
  @property() title = "";

  /** Icon to show before the title. */
  @property() icon?: BitwardenIcon;

  /**
   * Renders the pre-VFO1 layout (the `VFO1Foundation` feature flag off).
   *
   * @deprecated Remove when the VFO1 flag is removed.
   */
  @property({ type: Boolean, reflect: true }) legacy = false;

  @state() private filled = new Set<SlotName>();
  @state() private standalone = true;

  private readonly ownContext = new HeaderContext();
  private unsubscribe?: () => void;

  private readonly provider = new ContextProvider(this, headerContext, this.ownContext);

  // A wrapper's context wins so the wrapper and any breadcrumbs it hosts share one instance.
  private readonly ancestorContext = new ContextConsumer(
    this,
    headerContext,
    (context) => this.useContext(context),
    true,
  );

  private get context(): HeaderContext {
    return this.ancestorContext.value ?? this.ownContext;
  }

  connectedCallback() {
    super.connectedCallback();
    this.standalone = !this.closest("bit-layout, bit-page");
    if (!this.ancestorContext.value) {
      this.useContext(this.ownContext);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.unsubscribe?.();
    this.unsubscribe = undefined;
  }

  protected willUpdate() {
    this.context.promoteActiveBreadcrumb = !this.legacy;
  }

  private useContext(context: HeaderContext) {
    this.unsubscribe?.();
    this.unsubscribe = context.subscribe(() => this.requestUpdate());
    context.promoteActiveBreadcrumb = !this.legacy;
    if (this.provider.value !== context) {
      this.provider.setValue(context, true);
    }
    this.requestUpdate();
  }

  private onSlotChange(event: Event) {
    const slot = event.target as HTMLSlotElement;
    const name = (slot.name || "default") as SlotName;
    const next = new Set(this.filled);
    if (hasContent(slot)) {
      next.add(name);
    } else {
      next.delete(name);
    }
    this.filled = next;
  }

  private renderSlot(name: SlotName) {
    return name === "default"
      ? html`<slot @slotchange=${this.onSlotChange}></slot>`
      : html`<slot name=${name} @slotchange=${this.onSlotChange}></slot>`;
  }

  private renderPromotedSuffix() {
    const offset = this.context.titleSuffixOffset;
    return html`<div
      class="tw-flex tw-items-center ${typography("h1", { noMargin: true })} ${
        offset == null ? "" : "tw-absolute tw-top-1/2 -tw-translate-y-1/2 tw-ps-1"
      }"
      style=${offset == null ? nothing : `inset-inline-start: ${offset}px`}
      ${onResize((entry) => (this.context.titleSuffixWidth = entry.borderBoxSize[0]?.inlineSize ?? 0))}
    >
      <slot name="title-suffix"></slot>
    </div>`;
  }

  render() {
    return this.legacy ? this.renderLegacy() : this.renderVfo1();
  }

  private renderVfo1() {
    const hasTabs = this.filled.has("tabs");
    const promoted = this.context.hasPromotedHeading;
    return html`
      <header
        part="header"
        class="${this.standalone ? "standalone" : ""} tw-mb-8 tw-flex tw-flex-col tw-gap-6 @3xl:tw-gap-8 tw-pt-8 ${
          hasTabs ? "tw-border-0 tw-border-b tw-border-solid tw-border-border-base" : ""
        }"
      >
        <div class="tw-flex tw-flex-col @2xl:tw-flex-row tw-gap-4">
          <div class="tw-flex tw-min-w-0 tw-flex-1 tw-flex-col tw-gap-2">
            <div
              class="tw-relative tw-flex tw-items-center tw-h-full tw-gap-1"
              ?hidden=${!this.filled.has("breadcrumbs")}
            >
              ${this.renderSlot("breadcrumbs")} ${promoted ? this.renderPromotedSuffix() : nothing}
            </div>
            ${
              promoted
                ? nothing
                : html`<div class="tw-flex tw-items-center tw-gap-1">
                    <h1
                      class="${typography("h1", {
                        noMargin: true,
                      })} tw-m-0 tw-flex tw-min-w-0 tw-items-center tw-leading-10"
                      title=${this.title}
                    >
                      <div class="tw-flex tw-min-w-0 tw-items-center tw-gap-3">
                        <slot name="title-prefix"></slot>
                        <div class="tw-truncate">
                          ${this.icon ? html`<bit-icon name=${this.icon}></bit-icon>` : nothing}
                          ${this.title}
                        </div>
                      </div>
                    </h1>
                    <div class="tw-flex tw-items-center ${typography("h1", { noMargin: true })}">
                      <slot name="title-suffix"></slot>
                    </div>
                  </div>`
            }
            <div
              class="${typography("body1")} tw-text-fg-body tw-max-w-[800px]"
              ?hidden=${!this.filled.has("subtitle")}
            >
              ${this.renderSlot("subtitle")}
            </div>
          </div>
          <div
            class="tw-flex tw-min-w-max tw-items-center tw-justify-start @2xl:tw-justify-end tw-gap-3 tw-max-h-fit"
            ?hidden=${!this.filled.has("default")}
          >
            ${this.renderSlot("default")}
          </div>
        </div>
        <div class="-tw-mb-px" ?hidden=${!hasTabs}>${this.renderSlot("tabs")}</div>
      </header>
    `;
  }

  private renderLegacy() {
    const hasTabs = this.filled.has("tabs");
    return html`
      <header
        part="header"
        class="-tw-mt-6 -tw-mx-8 tw-mb-3 tw-flex tw-flex-col tw-gap-4 tw-py-6 tw-px-8 ${
          hasTabs
            ? "tw-border-0 tw-border-b tw-border-solid tw-border-secondary-100 tw-bg-background-alt tw-pb-0"
            : ""
        }"
      >
        <div class="tw-flex">
          <div class="tw-flex tw-min-w-0 tw-flex-1 tw-flex-col tw-gap-2">
            ${this.renderSlot("breadcrumbs")}
            <h1
              class="${typography("h1", {
                noMargin: true,
              })} tw-m-0 tw-mr-2 tw-leading-10 tw-flex tw-gap-1"
              title=${this.title}
            >
              <div class="tw-truncate">
                ${this.icon ? html`<i class="bwi ${this.icon}" aria-hidden="true"></i>` : nothing}
                ${this.title}
              </div>
              <div><slot name="title-suffix"></slot></div>
            </h1>
          </div>
          <div class="tw-ml-auto tw-flex tw-flex-col tw-gap-4">
            <div class="tw-flex tw-min-w-max tw-items-center tw-justify-end tw-gap-2">
              ${this.renderSlot("default")}
            </div>
            <div class="tw-ml-auto" ?hidden=${!this.filled.has("secondary")}>
              ${this.renderSlot("secondary")}
            </div>
          </div>
        </div>
        <div class="-tw-mb-px" ?hidden=${!hasTabs}>${this.renderSlot("tabs")}</div>
      </header>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-header": BitHeader;
  }
}
