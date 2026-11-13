import { css, html, nothing } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";

import "../../berry/berry";
import "../../icon/icon";
import { BitElement } from "../../core/bit-element";
import { t } from "../../core/i18n";
import { KeyManager } from "../../core/key-manager";
import type { BitMenu } from "../../menu/menu";
import {
  attachOverflowList,
  OverflowListHandle,
  OverflowListState,
} from "../../overflow-list/attach-overflow-list";
import { renderTabMenuItemContent, TabOverflowMenuController } from "../shared/overflow-menu";
import {
  TAB_HEADER_CLASSES,
  TAB_LABEL_CONTENT_CLASSES,
  TAB_LIST_CONTAINER_CLASSES,
  TAB_LIST_CONTAINER_GAP,
  tabListItemClasses,
} from "../shared/tab-styles";

import { BitTabLink } from "./tab-link";

/**
 * Navigation tabs: a `<nav>` of `bit-tab-link`s styled like content tabs. Links that don't fit
 * move into a "More" menu; the active link always stays visible. Arrow keys (with wrap) and
 * Home/End move between links; only the active link is in the tab order.
 *
 * @slot - `bit-tab-link` elements.
 */
@customElement("bit-tab-nav-bar")
export class BitTabNavBar extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: block;
      }
    `,
  ];

  /** Accessible name for the navigation landmark. */
  @property() label = "";

  @state() private links: BitTabLink[] = [];
  @state() private overflowState?: OverflowListState;

  @query("nav") private nav!: HTMLElement;
  @query("[data-more]") private moreButton?: HTMLButtonElement;
  @query("bit-menu") private overflowMenu?: BitMenu;

  private overflow?: OverflowListHandle;
  private labelSignature = "";

  private readonly menu = new TabOverflowMenuController(
    this,
    () => this.moreButton,
    () => this.overflowMenu,
  );

  private readonly keyManager = new KeyManager<HTMLElement>({
    items: () => this.focusableItems(),
    orientation: "horizontal",
    wrap: true,
  });

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener("bit-tab-link-change", this.onLinkChange);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener("bit-tab-link-change", this.onLinkChange);
    this.overflow?.destroy();
    this.overflow = undefined;
  }

  protected firstUpdated() {
    this.overflow = attachOverflowList(this.nav, {
      items: () => this.links,
      trigger: () => this.moreButton,
      gap: TAB_LIST_CONTAINER_GAP,
      pinIndex: this.activeIndex,
      onChange: (next) => (this.overflowState = next),
    });
  }

  protected updated() {
    // Roving tabindex: one link is the nav's tab stop. Falls back to the first enabled link when
    // none is active so the nav stays focusable.
    const activeIndex = this.activeIndex;
    const tabStop = activeIndex ?? this.links.findIndex((link) => !link.disabled);
    this.links.forEach((link, i) => (link.rovingTabIndex = i === tabStop ? 0 : -1));

    this.overflow?.update({ pinIndex: activeIndex });
    const signature = JSON.stringify(
      this.links.map((link) => [link.displayText, link.startIcon, link.endIcon, link.berryValue]),
    );
    if (signature !== this.labelSignature) {
      this.labelSignature = signature;
      this.overflow?.remeasure();
    }
  }

  private get activeIndex(): number | null {
    const index = this.links.findIndex((link) => link.active && !link.disabled);
    return index === -1 ? null : index;
  }

  private focusableItems(): HTMLElement[] {
    const items: HTMLElement[] = [...this.links];
    if (this.moreButton) {
      items.push(this.moreButton);
    }
    return items.filter((item) => !item.hidden);
  }

  private onLinkChange = () => this.requestUpdate();

  private onSlotChange = (event: Event) => {
    const slot = event.target as HTMLSlotElement;
    this.links = slot.assignedElements().filter((el): el is BitTabLink => el instanceof BitTabLink);
  };

  private onKeydown = (event: KeyboardEvent) => {
    const items = this.focusableItems();
    const current = event
      .composedPath()
      .find((el): el is HTMLElement => items.includes(el as HTMLElement));
    if (!current) {
      return;
    }
    this.keyManager.activeIndex = items.indexOf(current);
    if (this.keyManager.onKeydown(event)) {
      event.preventDefault();
    }
  };

  private onMenuLinkClick(event: MouseEvent, index: number) {
    if (event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }
    // Route activation through the real link so consumers' click handlers (e.g. a client-side
    // router) see it, and don't navigate twice.
    event.preventDefault();
    this.links[index]?.click();
  }

  render() {
    const state = this.overflowState;
    const overflow = state?.overflow ?? [];

    return html`
      <div class=${TAB_HEADER_CLASSES} @keydown=${this.onKeydown}>
        <nav
          aria-label=${this.label || nothing}
          class="${TAB_LIST_CONTAINER_CLASSES} ${state?.ready ? "" : "tw-invisible"}"
          style="gap: ${TAB_LIST_CONTAINER_GAP}px"
        >
          <slot @slotchange=${this.onSlotChange}></slot>
          <button
            data-more
            type="button"
            class="${tabListItemClasses({})} tw-shrink-0"
            tabindex="-1"
          >
            <span class=${TAB_LABEL_CONTENT_CLASSES}>
              ${t("more")}
              <bit-berry .value=${overflow.length}></bit-berry>
              <bit-icon name="bwi-angle-down" class="tw-text-base"></bit-icon>
            </span>
          </button>
        </nav>
      </div>
      <bit-menu label=${this.label || nothing}>
        ${overflow.map((i) => {
          const link = this.links[i];
          return html`<bit-menu-item
            href=${link?.href ?? ""}
            target=${link?.target ?? nothing}
            ?disabled=${link?.disabled}
            ?current=${link?.active}
            @click=${(event: MouseEvent) => this.onMenuLinkClick(event, i)}
          >
            ${renderTabMenuItemContent({
              label: link?.displayText ?? "",
              startIcon: link?.startIcon,
              endIcon: link?.endIcon,
              berryValue: link?.berryValue,
            })}
          </bit-menu-item>`;
        })}
      </bit-menu>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-tab-nav-bar": BitTabNavBar;
  }
}
