import { css, html, nothing, PropertyValues } from "lit";
import { customElement, property, query, queryAll, state } from "lit/decorators.js";

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
import { renderTabLabel } from "../shared/tab-label";
import {
  TAB_HEADER_CLASSES,
  TAB_LABEL_CONTENT_CLASSES,
  TAB_LIST_CONTAINER_CLASSES,
  TAB_LIST_CONTAINER_GAP,
  tabListItemClasses,
} from "../shared/tab-styles";

import { BitTab } from "./tab";

export type BitTabChangeEvent = {
  /** The currently selected tab index. */
  index: number;
  /** The currently selected tab. */
  tab: BitTab;
};

/**
 * Content tabs. Each `bit-tab` child is a panel; the group renders the tab list with the full
 * ARIA tablist keyboard pattern (arrows with wrap, Home/End; Enter/Space selects). Tabs that
 * don't fit move into a "More" menu; the selected tab always stays visible.
 *
 * @slot - `bit-tab` elements.
 * @fires selectedIndexChange - `CustomEvent<number>` when the user selects a tab.
 * @fires selectedTabChange - `CustomEvent<BitTabChangeEvent>` whenever the selected tab changes
 *   after the first render.
 */
@customElement("bit-tab-group")
export class BitTabGroup extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: block;
      }
    `,
  ];

  /** Accessible name for the tab list. */
  @property() label = "";

  /**
   * Keep the content of off-screen tabs in the DOM. Useful for keeping `audio` or `video`
   * elements from re-initializing after navigating between tabs.
   */
  @property({ type: Boolean, attribute: "preserve-content" }) preserveContent = false;

  /** The index of the active tab. */
  @property({ type: Number, attribute: "selected-index" }) selectedIndex = 0;

  @state() private tabs: BitTab[] = [];
  @state() private overflowState?: OverflowListState;

  @query("[role=tablist]") private tablist!: HTMLElement;
  @query("[data-more]") private moreButton?: HTMLButtonElement;
  @query("bit-menu") private overflowMenu?: BitMenu;
  @queryAll("[role=tab]") private tabButtons!: NodeListOf<HTMLButtonElement>;

  private activeTab?: BitTab;
  private initialized = false;
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

  /** Selects the tab at `index`. */
  selectTab(index: number) {
    if (index === this.selectedIndex) {
      return;
    }
    this.selectedIndex = index;
    this.dispatchEvent(
      new CustomEvent<number>("selectedIndexChange", {
        detail: index,
        bubbles: true,
        composed: true,
      }),
    );
  }

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener("bit-tab-change", this.onTabChange);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener("bit-tab-change", this.onTabChange);
    this.overflow?.destroy();
    this.overflow = undefined;
  }

  protected willUpdate(changed: PropertyValues) {
    if (!changed.has("tabs") && !changed.has("selectedIndex")) {
      return;
    }
    const tabs = this.tabs;
    let index = this.clamp(this.selectedIndex);

    // When only the tab set changed, keep the previously active tab selected (its index may
    // have shifted). If it was removed, the clamped index takes over.
    if (!changed.has("selectedIndex") && this.activeTab && tabs.includes(this.activeTab)) {
      index = tabs.indexOf(this.activeTab);
    }
    this.selectedIndex = index;

    const next = tabs[index];
    if (next !== this.activeTab) {
      const previous = this.activeTab;
      this.activeTab = next;
      if (this.initialized && next && previous !== undefined) {
        this.dispatchEvent(
          new CustomEvent<BitTabChangeEvent>("selectedTabChange", {
            detail: { index, tab: next },
            bubbles: true,
            composed: true,
          }),
        );
      }
    }
    tabs.forEach((tab, i) => {
      tab.active = i === index;
      tab.preserveContent = this.preserveContent;
    });
  }

  protected firstUpdated() {
    this.overflow = attachOverflowList(this.tablist, {
      items: () => Array.from(this.tabButtons),
      trigger: () => this.moreButton,
      gap: TAB_LIST_CONTAINER_GAP,
      pinIndex: this.selectedIndex,
      onChange: (next) => (this.overflowState = next),
    });
  }

  protected updated(changed: PropertyValues) {
    if (changed.has("preserveContent")) {
      this.tabs.forEach((tab) => (tab.preserveContent = this.preserveContent));
    }
    const buttons = Array.from(this.tabButtons);
    this.tabs.forEach((tab, i) => {
      tab.tabButton = buttons[i] ?? null;
      if (buttons[i]) {
        buttons[i].ariaControlsElements = [tab];
      }
    });
    this.overflow?.update({ pinIndex: this.selectedIndex });

    // Labels, icons and berries change the items' widths without changing the item set.
    const signature = JSON.stringify(
      this.tabs.map((tab) => [tab.label, tab.startIcon, tab.endIcon, tab.berryValue]),
    );
    if (signature !== this.labelSignature) {
      const first = this.labelSignature === "";
      this.labelSignature = signature;
      if (!first) {
        this.overflow?.remeasure();
      }
    }
    this.initialized = this.tabs.length > 0;
  }

  private clamp(index: number) {
    return Math.min(this.tabs.length - 1, Math.max(index || 0, 0));
  }

  private focusableItems(): HTMLElement[] {
    const items: HTMLElement[] = [...Array.from(this.tabButtons)];
    if (this.moreButton) {
      items.push(this.moreButton);
    }
    // Skip anything the overflow list hid: overflowed tabs and the More button when unused.
    return items.filter((item) => !item.hidden);
  }

  private onTabChange = (event: Event) => {
    if (event.target !== this) {
      this.requestUpdate();
    }
  };

  private onSlotChange = (event: Event) => {
    const slot = event.target as HTMLSlotElement;
    this.tabs = slot.assignedElements().filter((el): el is BitTab => el instanceof BitTab);
  };

  private onKeydown = (event: KeyboardEvent) => {
    const focused = this.shadowRoot?.activeElement as HTMLElement | null;
    const items = this.focusableItems();
    if (!focused || !items.includes(focused)) {
      return;
    }
    this.keyManager.activeIndex = items.indexOf(focused);
    if (this.keyManager.onKeydown(event)) {
      event.preventDefault();
    }
  };

  render() {
    const state = this.overflowState;
    const overflow = state?.overflow ?? [];
    const shrinkIndex = state?.shrinkIndex ?? -1;

    return html`
      <div class=${TAB_HEADER_CLASSES} @keydown=${this.onKeydown}>
        <div
          role="tablist"
          aria-label=${this.label || nothing}
          class="${TAB_LIST_CONTAINER_CLASSES} ${state?.ready ? "" : "tw-invisible"}"
          style="gap: ${TAB_LIST_CONTAINER_GAP}px"
        >
          ${this.tabs.map((tab, i) => {
            const selected = i === this.selectedIndex;
            return html`<button
              type="button"
              role="tab"
              class="${tabListItemClasses({ active: tab.active, disabled: tab.disabled })} ${
                i === shrinkIndex ? "tw-flex-1 tw-min-w-0 tw-overflow-hidden" : "tw-shrink-0"
              }"
              ?disabled=${tab.disabled}
              aria-selected=${selected ? "true" : "false"}
              tabindex=${selected ? 0 : -1}
              @click=${() => this.selectTab(i)}
            >
              ${renderTabLabel(tab, tab.label)}
            </button>`;
          })}
          <!--
            The More button sits inside the overflow list so it lands immediately after the last
            visible tab. The list hides it when there's nothing to surface, which also takes it out
            of focus and the accessibility tree.
          -->
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
        </div>
      </div>
      <div class="tw-pt-5">
        <slot @slotchange=${this.onSlotChange}></slot>
      </div>
      <bit-menu label=${this.label || nothing}>
        ${overflow.map((i) => {
          const tab = this.tabs[i];
          return html`<bit-menu-item ?disabled=${tab?.disabled} @click=${() => this.selectTab(i)}>
            ${renderTabMenuItemContent({
              label: tab?.label ?? "",
              startIcon: tab?.startIcon,
              endIcon: tab?.endIcon,
              berryValue: tab?.berryValue,
            })}
          </bit-menu-item>`;
        })}
      </bit-menu>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-tab-group": BitTabGroup;
  }
  interface HTMLElementEventMap {
    selectedTabChange: CustomEvent<BitTabChangeEvent>;
  }
}
