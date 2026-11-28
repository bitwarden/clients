import { css, html, nothing, PropertyValues } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";

import { BitFormControlElement } from "../core/form-control";
import { KeyManager } from "../core/key-manager";
import "../select/select";
import type { SelectOption } from "../select/option";
import type { BitSelect } from "../select/select";

import { BitToggle } from "./toggle";

type DisplayMode = "inline" | "full-width" | "dropdown";

/**
 * A segmented control for quick filters; behaves as a radio group. Arrow keys move and select;
 * only the selected toggle is in the tab order.
 *
 * Adapts to its space: when the container is narrower than the toggles' natural width it
 * collapses into a dropdown, and expands again when there's room. `selectedChange` fires the same
 * way in every mode.
 *
 * Form-associated: submits `selected` under `name`.
 *
 * @slot - `bit-toggle` elements.
 * @fires selectedChange - `CustomEvent<unknown>` with the new value when the user selects.
 * @fires change - When the user selects.
 */
@customElement("bit-toggle-group")
export class BitToggleGroup extends BitFormControlElement<unknown> {
  static styles = [
    BitFormControlElement.styles,
    css`
      :host {
        display: block;
      }
      @media (min-width: 768px) {
        :host(:not(:state(full-width))) {
          display: inline-block;
        }
      }
      :host(:state(inline)) {
        display: inline-block;
      }
      :host(:state(full-width)),
      :host(:state(dropdown)) {
        display: block;
      }
    `,
  ];

  /** The selected toggle's value. Defaults to the first toggle's value. */
  @property({ attribute: "selected" }) selected: unknown;

  /** Take the full width of the container, sizing each toggle equally. */
  @property({ type: Boolean, attribute: "full-width" }) fullWidth = false;

  /** Stay inline at all breakpoints and never expand to full width. */
  @property({ type: Boolean }) inline = false;

  /**
   * Accessible name. Used as the radiogroup's label, and as the dropdown's (screen-reader-only)
   * label when the group collapses.
   */
  @property() label?: string;

  @state() private toggles: BitToggle[] = [];
  @state() private displayMode: DisplayMode = "inline";

  @query("bit-select") private select?: BitSelect<unknown>;

  private naturalWidth = 0;
  private readonly resizeObserver = new ResizeObserver(([entry]) => {
    const width = Math.floor(entry.borderBoxSize?.[0]?.inlineSize ?? entry.contentRect.width);
    this.applyWidth(width);
  });

  private readonly keyManager = new KeyManager<BitToggle>({
    items: () => this.toggles,
    orientation: "both",
    wrap: true,
    onActiveChange: (toggle) => toggle && this.choose(toggle.value),
  });

  get value(): unknown {
    return this.selected;
  }

  set value(value: unknown) {
    this.selected = value;
  }

  protected get validationTarget() {
    return this.select ?? this.toggles.find((toggle) => toggle.checked) ?? this.toggles[0];
  }

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener("bit-toggle-select", this.onToggleSelect);
    this.addEventListener("bit-toggle-change", this.onToggleChange);
    this.addEventListener("keydown", this.onKeydown);
    this.resizeObserver.observe(this);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener("bit-toggle-select", this.onToggleSelect);
    this.removeEventListener("bit-toggle-change", this.onToggleChange);
    this.removeEventListener("keydown", this.onKeydown);
    this.resizeObserver.disconnect();
  }

  protected willUpdate(changed: PropertyValues) {
    if (this.selected === undefined && this.toggles.length) {
      this.selected = this.toggles[0].value;
    }
    super.willUpdate(changed);

    const dropdown = this.displayMode === "dropdown";
    this.internals.role = dropdown ? null : "radiogroup";
    this.internals.ariaLabel = dropdown ? null : (this.label ?? null);
    for (const mode of ["inline", "full-width", "dropdown"] as const) {
      this.internals.states.delete(mode);
    }
    if (dropdown) {
      this.internals.states.add("dropdown");
    } else if (this.displayMode === "full-width" || this.fullWidth) {
      this.internals.states.add("full-width");
    } else if (this.inline) {
      this.internals.states.add("inline");
    }
  }

  protected updated(changed: PropertyValues) {
    super.updated(changed);
    const toggles = this.toggles;
    const activeIndex = toggles.findIndex((toggle) => toggle.value === this.selected);
    const tabStop = activeIndex >= 0 ? toggles[activeIndex] : toggles[0];
    toggles.forEach((toggle, i) => {
      toggle.checked = i === activeIndex;
      toggle.tabbable = toggle === tabStop;
      toggle.disabled = this.isDisabled;
      // Hide the divider after the last toggle and next to the active pill.
      toggle.hideDivider = i === toggles.length - 1 || i === activeIndex || i + 1 === activeIndex;
    });
    if (changed.has("toggles") || changed.has("fullWidth")) {
      this.measure();
    }
  }

  /**
   * Re-measures the natural width whenever the toggles change; consumers often render them
   * after the first paint.
   */
  private measure() {
    // In dropdown mode the toggles aren't rendered, so measuring would capture the dropdown.
    if (this.toggles.length === 0 || this.displayMode === "dropdown") {
      return;
    }
    // Force max-content to measure the unconstrained width. Math.floor avoids a sub-pixel
    // oscillation loop between getBoundingClientRect and ResizeObserver's borderBoxSize inside
    // transformed/padded containers.
    this.style.width = "max-content";
    this.style.maxWidth = "none";
    this.naturalWidth = Math.floor(this.getBoundingClientRect().width);
    this.style.maxWidth = "";
    this.style.width = "";
    this.applyWidth(Math.floor(this.getBoundingClientRect().width));
  }

  private applyWidth(width: number) {
    if (this.naturalWidth === 0) {
      return;
    }
    const mode = this.displayMode;
    if (width < this.naturalWidth && mode !== "dropdown") {
      this.displayMode = "dropdown";
    } else if (width >= this.naturalWidth && mode === "dropdown") {
      this.displayMode = this.fullWidth ? "full-width" : "inline";
    } else if (mode !== "dropdown") {
      this.displayMode = this.fullWidth ? "full-width" : "inline";
    }
  }

  private choose(value: unknown) {
    if (value === this.selected || this.isDisabled) {
      return;
    }
    this.setValue(value);
    this.dispatchEvent(
      new CustomEvent("selectedChange", { detail: value, bubbles: true, composed: true }),
    );
  }

  private onToggleSelect = (event: Event) => {
    const toggle = event.composedPath().find((el): el is BitToggle => el instanceof BitToggle);
    if (toggle) {
      this.choose(toggle.value);
    }
  };

  private onToggleChange = () => this.requestUpdate();

  private onKeydown = (event: KeyboardEvent) => {
    if (this.displayMode === "dropdown" || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    const current = event.composedPath().find((el): el is BitToggle => el instanceof BitToggle);
    if (!current || event.key === "Home" || event.key === "End") {
      return;
    }
    this.keyManager.activeIndex = this.toggles.indexOf(current);
    if (this.keyManager.onKeydown(event)) {
      event.preventDefault();
    }
  };

  private onSlotChange = (event: Event) => {
    this.toggles = (event.target as HTMLSlotElement)
      .assignedElements()
      .filter((el): el is BitToggle => el instanceof BitToggle);
  };

  private onSelectChange = (event: Event) => {
    this.choose((event.target as BitSelect<unknown>).value);
  };

  private renderDropdown() {
    const items: SelectOption<unknown>[] = this.toggles.map((toggle) => ({
      value: toggle.value,
      label: toggle.labelText,
      metaData: toggle.berry?.content,
      icon: toggle.value === this.selected ? "bwi-check" : undefined,
    }));
    return html`<bit-select
      label=${this.label ?? nothing}
      hide-label
      disable-margin
      .items=${items}
      .value=${this.selected}
      ?disabled=${this.isDisabled}
      @change=${this.onSelectChange}
      @blur=${this.markTouchedOnBlur}
    ></bit-select>`;
  }

  render() {
    if (this.displayMode === "dropdown") {
      // The slot isn't rendered, so the toggles stay in the DOM (and in `toggles`) but hidden.
      return html`${this.renderDropdown()}<slot hidden @slotchange=${this.onSlotChange}></slot>`;
    }
    const activeIndex = this.toggles.findIndex((toggle) => toggle.value === this.selected);
    const classes = [
      "tw-grid",
      "tw-w-full",
      "tw-gap-1",
      "tw-auto-cols-fr",
      "tw-grid-flow-col",
      "tw-border",
      "tw-border-solid",
      "tw-rounded-2xl",
      "tw-border-border-base",
      "tw-p-1",
      "tw-relative",
      "after:tw-content-['']",
      "after:tw-rounded-xl",
      "after:tw-pointer-events-none",
      "after:tw-absolute",
      "after:tw-top-1",
      "after:tw-left-1",
      "after:tw-h-[calc(100%_-_theme(spacing.2))]",
      // Width accounts for left+right padding AND (count-1) grid gaps (tw-gap-1 = spacing.1 each).
      // Total to subtract = (count+1)*spacing.1, written as count*spacing.1 + spacing.1.
      "after:tw-w-[calc((100%_-_var(--toggle-count)*theme(spacing.1)_-_theme(spacing.1))/var(--toggle-count,1))]",
      // Translate by (slot-width + one gap) per step: 100% = pill's own width, + spacing.1 = gap.
      "after:tw-translate-x-[calc(var(--active-toggle,0)*(100%_+_theme(spacing.1)))]",
      "after:tw-transition-transform",
      "after:tw-duration-[225ms]",
      "after:tw-bg-bg-brand-stronger",
      activeIndex >= 0 ? "after:tw-opacity-100" : "after:tw-opacity-0",
    ].join(" ");

    return html`<div
      part="group"
      class=${classes}
      style="--toggle-count: ${this.toggles.length}; --active-toggle: ${Math.max(activeIndex, 0)}"
    >
      <slot @slotchange=${this.onSlotChange}></slot>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-toggle-group": BitToggleGroup;
  }
}
