import { css, html, nothing, PropertyValues, unsafeCSS } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";

import { BitElement } from "../core/bit-element";
import { popoverResetCss } from "../core/overlay";

import { DeclarativeMenuController } from "./declarative";
import { MenuPosition } from "./menu-positions";
import { MENU_CLOSE_ATTRIBUTE, MENU_ITEM_SELECTOR } from "./menu-styles";

type MenuItemLike = HTMLElement & { disabled?: boolean };

/** Collects menu items in tree order, including ones nested in other elements or their shadow roots. */
function collectItems(root: ParentNode, result: MenuItemLike[]) {
  for (const child of Array.from(root.children)) {
    if (child.matches(MENU_ITEM_SELECTOR)) {
      result.push(child as MenuItemLike);
    } else if (child.localName !== "bit-menu") {
      collectItems(child, result);
      if (child.shadowRoot) {
        collectItems(child.shadowRoot, result);
      }
    }
  }
  return result;
}

/**
 * Floating list of actions, opened from a trigger. Items are `bit-menu-item`s (at any depth) and
 * `bit-menu-divider`s.
 *
 * Open it with `attachMenuTrigger` / the `menuTrigger()` directive, or declaratively with the
 * `trigger` attribute. Set `inline` to render the panel in place, without a trigger.
 *
 * @slot - Items.
 * @slot footer - Content below a divider, e.g. a filter menu's actions.
 * @fires closed - The menu closed.
 */
@customElement("bit-menu")
export class BitMenu extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: contents;
      }
      :host([inline]) {
        display: block;
      }
      .backdrop {
        ${unsafeCSS(popoverResetCss)}
        inset: 0;
        width: 100vw;
        height: 100vh;
        max-width: none;
        max-height: none;
      }
      .panel[popover] {
        ${unsafeCSS(popoverResetCss)}
      }
      .menu {
        max-height: calc(100vh - 2rem);
      }
      .point {
        position: fixed;
        width: 0;
        height: 0;
        pointer-events: none;
      }
    `,
  ];

  /** `dialog` for menus with interactive content (e.g. filters): Tab moves within it instead of closing it. */
  @property({ attribute: "menu-role" }) menuRole: "menu" | "dialog" = "menu";

  /** Accessible name, for menus that need to be told apart. */
  @property() label?: string;

  /** Render the panel in place instead of as an overlay. */
  @property({ type: Boolean, reflect: true }) inline = false;

  /** Id of an element in the same root that opens the menu on click. */
  @property() trigger?: string;

  /** With `trigger`: preferred position. */
  @property() position?: MenuPosition;

  /** With `trigger`: also open on right-click at the pointer. */
  @property({ type: Boolean, attribute: "context-menu" }) contextMenu = false;

  @state() private hasFooter = false;

  @query(".panel") private panelEl!: HTMLElement;

  @query(".backdrop") private backdropEl?: HTMLElement;

  @query(".menu") private menuEl!: HTMLElement;

  @query(".point") private pointEl!: HTMLElement;

  private onBackdrop?: () => void;
  private onRequestClose?: () => void;
  private onFocusFirstItem?: () => void;
  private owner?: { close(): void };

  private readonly declarative = new DeclarativeMenuController(this);

  /** Whether the menu is open. */
  get isOpen() {
    return !!this.owner;
  }

  /** Closes the menu if it's open. */
  close() {
    this.owner?.close();
  }

  /**
   * Moves focus to the first item of an open menu and resets keyboard navigation to it, e.g. after
   * replacing the items.
   */
  focusFirstItem() {
    this.onFocusFirstItem?.();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.close();
  }

  /** @internal Items in navigation order. */
  _items(): MenuItemLike[] {
    return collectItems(this, []);
  }

  /** @internal */
  get _floating() {
    return this.panelEl;
  }

  /** @internal The element with the menu role. */
  get _menu() {
    return this.menuEl;
  }

  /** @internal Zero-size anchor for context menus. */
  _point(x: number, y: number) {
    this.pointEl.style.left = `${x}px`;
    this.pointEl.style.top = `${y}px`;
    return this.pointEl;
  }

  /** @internal */
  _show(
    owner: { close(): void },
    opts: {
      backdrop: boolean;
      onBackdropClick: () => void;
      onRequestClose: () => void;
      onFocusFirstItem: () => void;
    },
  ) {
    if (this.owner && this.owner !== owner) {
      this.owner.close();
    }
    this.owner = owner;
    this.onBackdrop = opts.onBackdropClick;
    this.onRequestClose = opts.onRequestClose;
    this.onFocusFirstItem = opts.onFocusFirstItem;
    if (opts.backdrop) {
      this.backdropEl?.showPopover();
    }
    this.panelEl.showPopover();
  }

  /** @internal */
  _hide(owner: { close(): void }) {
    if (this.owner !== owner) {
      return;
    }
    this.owner = undefined;
    this.onBackdrop = undefined;
    this.onRequestClose = undefined;
    this.onFocusFirstItem = undefined;
    for (const el of [this.panelEl, this.backdropEl]) {
      if (el?.matches(":popover-open")) {
        el.hidePopover();
      }
    }
    this.dispatchEvent(new CustomEvent("closed", { bubbles: true, composed: true }));
  }

  protected updated(changed: PropertyValues<this>) {
    super.updated(changed);
    this.declarative.sync();
  }

  /** Closes on clicks on `[data-bit-menu-close]` content; other content (checkboxes, search) leaves it open. */
  private onContentClick(event: MouseEvent) {
    for (const el of event.composedPath()) {
      if (el === this.menuEl) {
        break;
      }
      if (!(el instanceof HTMLElement)) {
        continue;
      }
      if ((el as MenuItemLike).disabled) {
        return;
      }
      if (el.hasAttribute(MENU_CLOSE_ATTRIBUTE)) {
        this.onRequestClose?.();
        return;
      }
    }
  }

  render() {
    const menu = html`<div
      class="menu tw-flex tw-shrink-0 tw-flex-col tw-rounded-xl tw-border tw-border-solid tw-border-border-light tw-bg-bg-primary tw-shadow-lg tw-bg-clip-padding tw-overflow-y-auto"
      role=${this.menuRole}
      aria-label=${this.label ?? nothing}
      tabindex="-1"
      @click=${this.onContentClick}
    >
      <div role="none" class="tw-p-2 tw-flex tw-flex-col tw-gap-1"><slot></slot></div>
      <div
        role="none"
        class="tw-p-2 tw-border-0 tw-border-t tw-border-solid tw-border-border-base"
        ?hidden=${!this.hasFooter}
      >
        <slot
          name="footer"
          @slotchange=${(e: Event) =>
            (this.hasFooter = (e.target as HTMLSlotElement).assignedNodes().length > 0)}
        ></slot>
      </div>
    </div>`;

    if (this.inline) {
      return html`<div class="panel" part="panel">${menu}</div>`;
    }
    return html`
      <span class="point"></span>
      <div class="backdrop" popover="manual" @click=${() => this.onBackdrop?.()}></div>
      <div class="panel" part="panel" popover="manual">${menu}</div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-menu": BitMenu;
  }
}
