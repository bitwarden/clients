import { css, html, nothing, PropertyValues } from "lit";
import { customElement, property, query, queryAll, state } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";

import { BitElement } from "../../core/bit-element";
import { t } from "../../core/i18n";
import { BitwardenIcon } from "../../icon/shared-icon";
import {
  attachOverflowList,
  OverflowListHandle,
  OverflowListState,
} from "../../overflow-list/attach-overflow-list";
import { attachPopoverTrigger, PopoverAnchorHandle } from "../../popover/attach-popover";
import "../../popover/popover-panel";
import type { BitPopoverPanel } from "../../popover/popover-panel";
import { tooltip } from "../../tooltip/tooltip-directive";
import "../chip/chip";
import "../chip-action/chip-action";
import type { BitChipAction } from "../chip-action/chip-action";
import { ChipSize, ChipVariant } from "../shared/chip-styles";

/** A single chip rendered by `bit-chip-group`. */
export type ChipGroupItem = {
  /**
   * Stable identifier for the thing the chip stands for — a collection id, a folder id, a filter
   * key. Carried through `chipSelect` and `chipDismiss` so the consumer can act on the chip
   * without matching on its display text.
   */
  id: string;
  /** Text shown inside the chip. */
  label: string;
  /** In a dismissible group, names the dismiss button and fills the tooltip. Defaults to `label`. */
  accessibleName?: string;
  /** Visual variant of the chip. Defaults to `primary`. Ignored when dismissible. */
  variant?: ChipVariant;
  /** Leading icon shown inside the chip. */
  startIcon?: BitwardenIcon;
};

const GAP_PX = 8;

const emptyState: OverflowListState = {
  displayed: [],
  overflow: [],
  ready: false,
  measured: false,
  triggerHidden: false,
  shrinkIndex: -1,
  hiddenElements: new Set(),
};

/**
 * Displays a collection of chips in a horizontal row that doesn't wrap. Chips that don't fit the
 * container width are hidden, and a "+N" action chip at the end opens a popover listing them,
 * where they stay activatable. The first chip is pinned, so at least one chip is always visible.
 *
 * Chips are passed as data through `chips`; the group renders both the row and the popover from
 * that data. Activating any chip emits it through `chipSelect`; the group holds no selection state.
 * With `dismissible`, chips render as input chips whose only control is a dismiss button, emitting
 * through `chipDismiss` instead. Removing the chip is left to the consumer.
 *
 * Sizing is measurement-driven; resize the container and more or fewer chips become visible.
 *
 * @fires chipSelect - `CustomEvent<ChipGroupItem>` when a chip is activated.
 * @fires chipDismiss - `CustomEvent<ChipGroupItem>` when a chip's dismiss button is activated.
 */
@customElement("bit-chip-group")
export class BitChipGroup extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: block;
        min-width: 0;
      }
      [data-item] {
        flex-shrink: 0;
      }
      [data-item][data-overflow-shrink] {
        flex: 0 1 auto;
        min-width: 0;
        overflow: hidden;
      }
    `,
  ];

  @property({ attribute: false }) chips: ChipGroupItem[] = [];

  /** Size of every chip, including the "+N" chip. */
  @property({ reflect: true }) size: ChipSize = "large";

  /**
   * Accessible name for the group as a whole, e.g. "Shared folders". Omit when a nearby heading or
   * column header already supplies that context.
   */
  @property({ attribute: "accessible-name" }) accessibleName?: string;

  /** Renders every chip with a dismiss button, emitting through `chipDismiss`. */
  @property({ type: Boolean, reflect: true }) dismissible = false;

  @state() private listState: OverflowListState = emptyState;

  /** Held through the measurement reset after a removal, which briefly empties the overflow. */
  @state() private popoverChips: ChipGroupItem[] = [];

  @query("[data-row]") private row!: HTMLElement;
  @query("[data-trigger]") private trigger!: BitChipAction;
  @query("bit-popover-panel") private panel!: BitPopoverPanel;
  @queryAll("[data-item]") private itemEls!: NodeListOf<HTMLElement>;
  @queryAll("[data-popover-chip]") private popoverChipEls!: NodeListOf<HTMLElement>;

  private overflowList?: OverflowListHandle;
  private overflowPopover?: PopoverAnchorHandle;

  disconnectedCallback() {
    super.disconnectedCallback();
    this.overflowList?.destroy();
    this.overflowPopover?.destroy();
    this.overflowList = undefined;
    this.overflowPopover = undefined;
  }

  connectedCallback() {
    super.connectedCallback();
    if (this.hasUpdated && !this.overflowList) {
      this.attach();
    }
  }

  protected firstUpdated() {
    // On the shadow root: moves between controls inside it never reach host listeners.
    this.renderRoot.addEventListener("focusin", this.onFocusIn);
    this.renderRoot.addEventListener("focusout", this.onFocusOut as EventListener);
    this.attach();
  }

  private attach() {
    this.overflowList = attachOverflowList(this.row, {
      items: () => Array.from(this.itemEls),
      trigger: () => this.trigger,
      gap: GAP_PX,
      onChange: (next) => this.onOverflowChange(next),
    });
    this.overflowPopover = attachPopoverTrigger(this.trigger, this.panel);
  }

  protected willUpdate(changed: PropertyValues) {
    if (changed.has("chips") || changed.has("listState")) {
      if (this.listState.measured) {
        this.popoverChips = this.listState.overflow.map((i) => this.chips[i]).filter(Boolean);
      } else {
        const ids = new Set(this.chips.map((chip) => chip.id));
        this.popoverChips = this.popoverChips.filter((chip) => ids.has(chip.id));
      }
    }
  }

  protected updated(changed: PropertyValues<this>) {
    if (
      this.overflowList &&
      (changed.has("chips") || changed.has("size") || changed.has("dismissible"))
    ) {
      // Labels change in place on index-keyed chips, so the item set alone won't trigger a
      // remeasure.
      this.overflowList.update();
      this.overflowList.remeasure({ reset: true });
    }
  }

  /** The row control last holding focus. Kept when focus drops to nothing, e.g. it was hidden. */
  private lastFocused?: Element;

  private onFocusIn = () => {
    this.lastFocused = this.shadowRoot?.activeElement ?? undefined;
  };

  private onFocusOut = (event: FocusEvent) => {
    if (event.relatedTarget) {
      this.lastFocused = undefined;
    }
  };

  private onOverflowChange(next: OverflowListState) {
    const focusLost = document.activeElement == null || document.activeElement === document.body;
    const active = this.shadowRoot?.activeElement ?? (focusLost ? this.lastFocused : undefined);
    this.listState = next;

    // Dismissing a chip can free enough room that nothing overflows anymore, leaving an open
    // popover with nothing to list. Close it and hand focus back to the row.
    if (this.overflowPopover?.isOpen && next.measured && next.overflow.length === 0) {
      this.overflowPopover.close();
      void this.updateComplete.then(() => this.focusFallback()?.focus());
      return;
    }

    // The packing pass can hide the focused chip, or the "+N" trigger once nothing overflows.
    // The browser would drop focus on `document.body`; hand it to a control that survives.
    if (active instanceof HTMLElement && next.hiddenElements.has(active)) {
      void this.updateComplete.then(() => this.focusFallback()?.focus());
    }
  }

  /**
   * Where focus goes when the control holding it is hidden: the "+N" trigger, since it opens the
   * popover that now holds the hidden chips, else the last chip left in the row.
   */
  private focusFallback(): HTMLElement | undefined {
    const { hiddenElements, displayed } = this.listState;
    if (!hiddenElements.has(this.trigger)) {
      return this.trigger;
    }
    const items = Array.from(this.itemEls);
    for (let i = displayed.length - 1; i >= 0; i--) {
      const el = items[displayed[i]];
      if (el?.isConnected && !hiddenElements.has(el)) {
        return el;
      }
    }
    return undefined;
  }

  private emit(name: "chipSelect" | "chipDismiss", chip: ChipGroupItem) {
    this.dispatchEvent(
      new CustomEvent<ChipGroupItem>(name, { detail: chip, bubbles: true, composed: true }),
    );
  }

  /**
   * Closes the popover first: it's modal, and leaving it open over a list the consumer is about to
   * filter would strand focus in stale content.
   */
  private selectOverflowChip(chip: ChipGroupItem) {
    this.overflowPopover?.close();
    this.emit("chipSelect", chip);
  }

  /** Keeps the popover open so several chips can be cleared; only the last one closes it. */
  private dismissOverflowChip(chip: ChipGroupItem) {
    const listed = this.popoverChips;
    const index = listed.indexOf(chip);
    this.emit("chipDismiss", chip);
    if (listed.length <= 1) {
      this.overflowPopover?.close();
      return;
    }
    // After the emit, so the consumer's removal has been rendered.
    void this.updateComplete.then(() => {
      const chips = Array.from(this.popoverChipEls);
      chips[Math.min(index, chips.length - 1)]?.focus();
    });
  }

  private renderChip(chip: ChipGroupItem, inPopover: boolean, index = 0) {
    const shared = {
      pinned: !inPopover && index === 0,
      item: !inPopover,
    };
    if (this.dismissible) {
      const name = chip.accessibleName ?? chip.label;
      return html`<bit-chip
        ?data-item=${shared.item}
        ?data-popover-chip=${inPopover}
        ?data-overflow-pinned=${shared.pinned}
        size=${this.size}
        start-icon=${chip.startIcon ?? nothing}
        label=${chip.label}
        accessible-name=${chip.accessibleName ?? nothing}
        @dismissed=${() =>
          inPopover ? this.dismissOverflowChip(chip) : this.emit("chipDismiss", chip)}
        ${tooltip(name)}
      ></bit-chip>`;
    }
    return html`<bit-chip-action
      ?data-item=${shared.item}
      ?data-popover-chip=${inPopover}
      ?data-overflow-pinned=${shared.pinned}
      variant=${chip.variant ?? "primary"}
      size=${this.size}
      start-icon=${chip.startIcon ?? nothing}
      label=${chip.label}
      @click=${() => (inPopover ? this.selectOverflowChip(chip) : this.emit("chipSelect", chip))}
      ${tooltip(chip.label)}
    ></bit-chip-action>`;
  }

  render() {
    const count = this.listState.overflow.length;
    return html`
      <div
        data-row
        role="group"
        aria-label=${this.accessibleName ?? nothing}
        class="tw-flex tw-flex-nowrap tw-min-w-0 tw-items-center ${
          this.listState.ready ? "" : "tw-invisible"
        }"
        style="gap: ${GAP_PX}px"
      >
        ${repeat(
          this.chips,
          (_, index) => index,
          (chip, index) => this.renderChip(chip, false, index),
        )}
        <bit-chip-action
          data-trigger
          variant="subtle"
          size=${this.size}
          label="+${count}"
          accessible-name=${t("showMoreCount", count)}
          class="tw-shrink-0"
        ></bit-chip-action>
      </div>
      <bit-popover-panel padding="compact" accessible-name=${t("showMore")}>
        <div class="tw-flex tw-flex-col tw-items-start tw-gap-2">
          ${repeat(
            this.popoverChips,
            (chip) => chip.id,
            (chip) => this.renderChip(chip, true),
          )}
        </div>
      </bit-popover-panel>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-chip-group": BitChipGroup;
  }
  interface HTMLElementEventMap {
    chipSelect: CustomEvent<ChipGroupItem>;
    chipDismiss: CustomEvent<ChipGroupItem>;
  }
}
