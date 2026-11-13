import { css, html, nothing, PropertyValues } from "lit";
import { customElement, property, query, queryAll, state } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";

import { BitElement } from "../core/bit-element";
import { getDeepActiveElement } from "../core/focus";
import { t } from "../core/i18n";
import { KeyManager } from "../core/key-manager";
import type { BitMenu } from "../menu/menu";
import { menuTrigger } from "../menu/menu-directive";
import {
  attachOverflowList,
  OverflowListHandle,
  OverflowListState,
} from "../overflow-list/attach-overflow-list";
import { measureWidth, observeWidth, revealForMeasurement } from "../overflow-list/measure";

import { BitBulkAction, BitBulkAdditionalAction, BULK_ACTION_CHANGE_EVENT } from "./bulk-action";
import type { BitBulkActionButton } from "./bulk-action-button";
import "./bulk-action-button";
import { ModifierKeyTracker } from "./modifier-key";
import "../icon/icon";
import "../menu/menu";
import "../menu/menu-divider";
import "../menu/menu-item";

/**
 * Slack between the bar's intrinsic width and the wrapper width that triggers
 * compact mode. Engaging compact while the bar still has breathing room avoids
 * a "just barely fits" state where the bar visually crowds the viewport.
 */
const COMPACT_THRESHOLD_BUFFER_PX = 48;

const OVERFLOW_GAP_PX = 8;

const elementWithDividerClasses = [
  "tw-relative",
  // Pin in place when the bar narrows below its natural content — the overflow host (the bar's
  // flex-auto child) is the only thing that should give ground.
  "tw-shrink-0",
  "after:tw-content-['']",
  "after:tw-absolute",
  "after:tw-bg-bg-brand-strong",
  "after:tw-w-px",
  "after:tw-h-8",
  "after:tw-end-0",
  "after:tw-translate-x-[calc(theme(spacing.2)_+_1px)]",
  "after:tw-inset-y-0",
  "after:tw-my-auto",
].join(" ");

/**
 * A floating toolbar pinned to the bottom of the viewport that acts on a selection. It slides in
 * while `selected-count` is above zero.
 *
 * Declare actions with `bit-bulk-action` (toolbar row) and `bit-bulk-additional-action` (menu
 * only) children. In a narrow container labels collapse to icons with tooltips; when that isn't
 * enough, trailing actions pack into the "Additional actions" menu.
 *
 * Cmd/Ctrl+B moves focus into the bar while it's visible, and back on a second press.
 *
 * @slot - `bit-bulk-action` and `bit-bulk-additional-action` elements.
 * @fires clear - The Clear button was pressed; reset the selection.
 */
@customElement("bit-bulk-actions-bar")
export class BitBulkActionsBar extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: contents;
      }
    `,
  ];

  /** Number of currently-selected items. The bar is visible while it's above zero. */
  @property({ type: Number, attribute: "selected-count" }) selectedCount?: number;

  /** Whether labels are collapsed to icons. Managed by the bar from the available width. */
  @state() compact = true;

  @state() private primaries: BitBulkAction[] = [];
  @state() private additionals: BitBulkAdditionalAction[] = [];
  @state() private overflowState?: OverflowListState;
  @state() private wrapperWidth = 0;
  @state() private reservedShellWidth = 0;
  @state() private initialBarWidth = 0;

  @query(".wrapper") private wrapperEl!: HTMLElement;
  @query("[part=bar]") private barEl!: HTMLElement;
  @query(".overflow-host") private overflowHostEl!: HTMLElement;
  @query(".clear") private clearBtn?: BitBulkActionButton;
  @query(".more") private triggerBtn?: BitBulkActionButton;
  @queryAll("[data-primary]") private primaryBtns!: NodeListOf<BitBulkActionButton>;
  @query("bit-menu") private menuEl?: BitMenu;

  private overflow?: OverflowListHandle;
  private stopObservingWidth?: () => void;
  private readonly modifierKey = new ModifierKeyTracker(this);
  private previousFocus: HTMLElement | null = null;
  private activeItem?: BitBulkActionButton;

  private readonly keyManager = new KeyManager<BitBulkActionButton>({
    items: () => this.availableItems(),
    orientation: "horizontal",
    wrap: true,
    onActiveChange: (item) => this.setActiveItem(item),
  });

  constructor() {
    super();
    this.addEventListener(BULK_ACTION_CHANGE_EVENT, () => this.requestUpdate());
  }

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener("keydown", this.handleShortcut);
    if (this.hasUpdated) {
      this.attach();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("keydown", this.handleShortcut);
    this.detach();
  }

  private get count() {
    return this.selectedCount ?? 0;
  }

  private get visible() {
    return this.count > 0;
  }

  private get overflowContainerWidth(): number | null {
    if (this.wrapperWidth === 0 || this.reservedShellWidth === 0) {
      return null;
    }
    return Math.max(0, this.wrapperWidth - this.reservedShellWidth);
  }

  private get primaryButtons(): BitBulkActionButton[] {
    return Array.from(this.primaryBtns ?? []);
  }

  /** Toolbar items in navigation order. */
  private get managedItems(): BitBulkActionButton[] {
    return [this.clearBtn, ...this.primaryButtons, this.triggerBtn].filter(
      (item): item is BitBulkActionButton => item != null,
    );
  }

  private isUnavailable(item: BitBulkActionButton) {
    return item.disabled || item.hidden || !!this.overflowState?.hiddenElements.has(item);
  }

  private availableItems() {
    return this.managedItems.filter((item) => !this.isUnavailable(item));
  }

  private setActiveItem(item: BitBulkActionButton | undefined) {
    this.activeItem = item;
    this.managedItems.forEach((el) => (el.focusTabIndex = el === item ? 0 : -1));
  }

  private onSlotChange(event: Event) {
    const assigned = (event.target as HTMLSlotElement).assignedElements();
    this.primaries = assigned.filter((el): el is BitBulkAction => el instanceof BitBulkAction);
    this.additionals = assigned.filter(
      (el): el is BitBulkAdditionalAction => el instanceof BitBulkAdditionalAction,
    );
  }

  private attach() {
    this.detach();
    this.stopObservingWidth = observeWidth(this.wrapperEl, (width) => (this.wrapperWidth = width));
    this.overflow = attachOverflowList(this.overflowHostEl, {
      items: () => this.primaryButtons,
      trigger: () => this.triggerBtn,
      gap: OVERFLOW_GAP_PX,
      containerWidth: this.overflowContainerWidth,
      triggerAlwaysShow: this.additionals.length > 0,
      onChange: (next) => (this.overflowState = next),
    });
  }

  private detach() {
    this.stopObservingWidth?.();
    this.stopObservingWidth = undefined;
    this.overflow?.destroy();
    this.overflow = undefined;
  }

  protected firstUpdated() {
    this.attach();
    this.setActiveItem(this.clearBtn);
    // The menu trigger directive needs the rendered menu.
    this.requestUpdate();
  }

  protected updated(changed: PropertyValues) {
    const ready = this.overflowState?.ready ?? false;
    const becameReady =
      changed.has("overflowState") && ready && !changed.get("overflowState")?.ready;

    // `initialBarWidth` is a snapshot threshold. Re-evaluating on its change would close a flip
    // loop, since intrinsic width itself depends on density.
    if (changed.has("wrapperWidth") && this.wrapperWidth > 0 && this.initialBarWidth > 0) {
      this.compact = this.wrapperWidth < this.initialBarWidth + COMPACT_THRESHOLD_BUFFER_PX;
    }

    if (
      changed.has("primaries") ||
      changed.has("additionals") ||
      changed.has("wrapperWidth") ||
      changed.has("reservedShellWidth")
    ) {
      this.overflow?.update({
        containerWidth: this.overflowContainerWidth,
        triggerAlwaysShow: this.additionals.length > 0,
      });
    }

    if (ready && this.primaries.length > 0 && (changed.has("primaries") || becameReady)) {
      requestAnimationFrame(() => this.measureIntrinsicWidth());
    }

    // `compact` swaps label visibility and button padding, so cached widths go stale.
    if (changed.has("compact") && changed.get("compact") !== undefined) {
      void Promise.all(this.managedItems.map((item) => item.updateComplete)).then(() =>
        this.overflow?.remeasure(),
      );
    }

    // The shell holds the count and the clear button, so its width tracks digit count and
    // density. Only a compact reading is usable: a labeled clear button would inflate it.
    if (
      ready &&
      this.compact &&
      (changed.has("selectedCount") || changed.has("compact") || becameReady)
    ) {
      requestAnimationFrame(() => {
        const shellWidth = this.measureShellWidth();
        // Detached / unrendered layout — keep the last usable reading.
        if (shellWidth > 0) {
          this.reservedShellWidth = shellWidth;
        }
      });
    }

    if (changed.has("primaries")) {
      // New buttons start in the tab order.
      this.setActiveItem(this.activeItem);
    }
    if (changed.has("overflowState") || changed.has("primaries")) {
      this.repairRovingFocus();
    }
  }

  /**
   * Packing a button into the menu, or hiding the trigger once nothing overflows, would leave the
   * roving tabindex on a hidden item and drop the toolbar out of the tab order.
   */
  private repairRovingFocus() {
    const active = this.activeItem;
    if (active && active.isConnected && !this.isUnavailable(active)) {
      return;
    }
    const next = this.availableItems()[0];
    if (!next) {
      return;
    }
    const hadFocus = !!active && this.shadowRoot?.activeElement === active;
    this.setActiveItem(next);
    if (hadFocus) {
      next.focus();
    }
  }

  /**
   * Width of everything in the bar except the overflow item row. Returns 0 for an unmeasurable
   * layout.
   */
  private measureShellWidth(): number {
    // Hidden items report zero width, so reveal them for the read. The overflow list re-applies
    // the right hidden states on its next pass.
    const restore = this.primaryButtons.map(revealForMeasurement);
    const shellWidth = measureWidth(this.barEl) - measureWidth(this.overflowHostEl);
    restore.forEach((fn) => fn());
    return shellWidth;
  }

  private measureIntrinsicWidth() {
    const trigger = this.triggerBtn;
    const labeled = this.managedItems.filter((btn) => btn !== trigger);

    // `min-width: max-content` stops a constrained flex parent from compressing the bar below
    // its content. Mutate → measure → restore is synchronous, so the expanded state never paints.
    // The additional-actions trigger stays icon-only by design.
    const restore = [...this.primaryButtons, ...(trigger ? [trigger] : [])].map(
      revealForMeasurement,
    );
    const previousMinWidth = this.barEl.style.minWidth;
    this.barEl.style.minWidth = "max-content";
    labeled.forEach((btn) => btn.forceLabelVisible(true));
    const barWidth = measureWidth(this.barEl);
    labeled.forEach((btn) => btn.forceLabelVisible(false));
    this.barEl.style.minWidth = previousMinWidth;
    restore.forEach((fn) => fn());

    if (barWidth === 0) {
      return;
    }
    this.initialBarWidth = barWidth;
    this.compact = this.wrapperEl.clientWidth < barWidth + COMPACT_THRESHOLD_BUFFER_PX;
  }

  private onToolbarKeydown(event: KeyboardEvent) {
    const items = this.availableItems();
    this.keyManager.activeIndex = this.activeItem ? items.indexOf(this.activeItem) : -1;
    if (this.keyManager.onKeydown(event)) {
      event.preventDefault();
    }
  }

  private handleShortcut = (event: KeyboardEvent) => {
    if (!this.visible) {
      return;
    }
    // Cmd+B (Mac) or Ctrl+B (Windows/Linux) — exactly one of metaKey/ctrlKey.
    if (event.key?.toLowerCase() !== "b" || event.metaKey === event.ctrlKey) {
      return;
    }
    event.preventDefault();

    const inner = this.shadowRoot?.activeElement;
    if (inner && this.barEl.contains(inner)) {
      this.restorePreviousFocus();
      return;
    }

    const active = getDeepActiveElement() as HTMLElement | null;
    this.previousFocus = active && active !== document.body ? active : null;
    this.keyManager.setFirstItemActive();
  };

  private onClear() {
    this.dispatchEvent(new CustomEvent("clear", { bubbles: true, composed: true }));
    this.restorePreviousFocus();
  }

  private restorePreviousFocus() {
    const prev = this.previousFocus;
    this.previousFocus = null;
    if (prev && prev.isConnected && !prev.hasAttribute("disabled") && prev.tabIndex !== -1) {
      prev.focus();
    } else {
      // `body.focus()` is a no-op, so drop focus explicitly to leave the bar.
      (getDeepActiveElement() as HTMLElement | null)?.blur();
    }
  }

  private get announcement() {
    if (this.count === 0) {
      return t("selectionCleared");
    }
    return t("bulkActionsBarAnnouncement", this.count, `${this.modifierKey.value}+B`);
  }

  private renderMenu() {
    const overflowed = (this.overflowState?.overflow ?? [])
      .map((i) => this.primaries[i])
      .filter(Boolean);
    return html`<bit-menu>
      ${overflowed.map(
        (primary) =>
          html`<bit-menu-item ?disabled=${primary.disabled} @click=${() => primary.run()}>
            <bit-icon slot="start" name=${primary.icon}></bit-icon>
            ${primary.label}
          </bit-menu-item>`,
      )}
      ${
        overflowed.length > 0 && this.additionals.length > 0
          ? html`<bit-menu-divider></bit-menu-divider>`
          : nothing
      }
      ${this.additionals.map(
        (additional) =>
          html`<bit-menu-item ?disabled=${additional.disabled} @click=${() => additional.run()}>
            ${
              additional.icon
                ? html`<bit-icon slot="start" name=${additional.icon}></bit-icon>`
                : nothing
            }
            ${additional.label}
          </bit-menu-item>`,
      )}
    </bit-menu>`;
  }

  render() {
    const ready = this.overflowState?.ready ?? false;
    const barState = this.visible ? "tw-pointer-events-auto" : "tw-translate-y-[110%] tw-opacity-0";

    // `pointer-events-none`: the wrapper is an invisible full-width band across the bottom of the
    // viewport. Left hit-testable, it swallows clicks meant for whatever sits under it — a table's
    // own paginator, for one. The bar opts back in while visible.
    return html`<div
        class="wrapper tw-pointer-events-none tw-fixed tw-bottom-0 tw-inset-x-0 tw-z-50 tw-flex tw-justify-center"
      >
        <div role="status" aria-live="polite" class="tw-sr-only">${this.announcement}</div>

        <!-- 17px gap need to visually align clear button divider element spacing -->
        <div
          part="bar"
          class="tw-mb-4 tw-flex tw-items-center tw-gap-[17px] tw-p-2 tw-rounded-xl tw-bg-bg-brand-stronger tw-transition-[transform,opacity] tw-duration-200 tw-ease-out tw-max-w-full ${barState}"
          ?inert=${!this.visible}
          aria-hidden=${this.visible ? nothing : "true"}
          role="toolbar"
          aria-orientation="horizontal"
          aria-label=${t("bulkActionsBar")}
          @keydown=${this.onToolbarKeydown}
        >
          <span class="tw-flex tw-gap-1.5 tw-px-2 tw-text-sm ${elementWithDividerClasses}">
            <span class="tw-font-semibold tw-text-fg-contrast" data-testid="bit-bulk-actions-count"
              >${this.count}</span
            >
            <span class="tw-text-fg-contrast-strong">${t("selectedLowercase")}</span>
          </span>
          <bit-bulk-action-button
            class="clear ${elementWithDividerClasses}"
            icon="bwi-clear"
            ?compact=${this.compact}
            @click=${this.onClear}
            >${t("clear")}</bit-bulk-action-button
          >

          <div
            class="overflow-host tw-flex tw-items-center tw-flex-auto tw-min-w-0 ${
              ready && this.overflowContainerWidth !== null ? "" : "tw-invisible"
            }"
            style="gap: ${OVERFLOW_GAP_PX}px"
          >
            ${repeat(
              this.primaries,
              (primary) => primary,
              (primary) =>
                html`<bit-bulk-action-button
                  data-primary
                  icon=${primary.icon}
                  ?compact=${this.compact}
                  ?disabled=${primary.disabled}
                  @click=${() => primary.run()}
                  >${primary.label}</bit-bulk-action-button
                >`,
            )}
            <bit-bulk-action-button
              class="more"
              data-testid="bit-bulk-actions-menu"
              icon="bwi-ellipsis-v"
              compact
              ${menuTrigger(this.menuEl, { position: "above-end" })}
              >${t("additionalActions")}</bit-bulk-action-button
            >
          </div>
        </div>
        <slot @slotchange=${this.onSlotChange}></slot>
      </div>
      ${this.renderMenu()}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-bulk-actions-bar": BitBulkActionsBar;
  }
}
