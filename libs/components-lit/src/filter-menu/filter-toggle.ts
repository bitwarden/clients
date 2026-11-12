import { html, nothing } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";

import { ariaDisable } from "../a11y/aria-disable";
import type { BitwardenIcon } from "../icon/shared-icon";
import { tooltip } from "../tooltip/tooltip-directive";
import "../icon/icon";

import { filterChipClasses, triggerClasses } from "./chip-styles";
import { BitFilterChipBase, DISABLED_REASON_ID } from "./filter-chip-base";
import { FilterPresenter, FilterSelection } from "./filter-model";

const chipPadding = {
  small: "tw-ps-1.5 tw-py-[calc(theme(spacing[0.5])_-_1px)]",
  large: "tw-ps-2 tw-py-[calc(theme(spacing.1)_-_1px)]",
};

/**
 * A single on/off filter chip — no menu. Its value is a boolean.
 *
 * ```html
 * <bit-filter-toggle key="favorites" label="Favorites" icon="bwi-star" icon-active="bwi-star-f">
 * </bit-filter-toggle>
 * ```
 *
 * @fires filterChange - `CustomEvent<{ key, value }>` when the toggle flips.
 * @csspart trigger - The chip's button.
 */
@customElement("bit-filter-toggle")
export class BitFilterToggle extends BitFilterChipBase implements FilterPresenter {
  /** The chip's label. */
  @property() label = "";

  /** Icon shown while active — e.g. `bwi-star-f` for an outline `bwi-star`. Falls back to `icon`. */
  @property({ attribute: "icon-active" }) iconActive?: BitwardenIcon;

  @state() private on = false;

  @query("[part=trigger]") readonly ariaTarget!: HTMLElement | null;

  /** The toggle's boolean value. */
  get value(): boolean {
    return this.on;
  }

  get clearedValue(): boolean {
    return false;
  }

  /** Whether the toggle is on. */
  get active(): boolean {
    return this.on;
  }

  /** @see FilterPresenter.multiple — a toggle holds one boolean. */
  get multiple(): boolean {
    return false;
  }

  /** @see FilterPresenter.summary — a toggle has no per-option summary. */
  get summary(): string {
    return "";
  }

  /** @see FilterPresenter.selections — a toggle has no options; `active` stands in for them. */
  get selections(): readonly FilterSelection[] {
    return [];
  }

  /** @see FilterPresenter.optionsTemplate — a toggle has no drill-in; it flips in place. */
  optionsTemplate(): undefined {
    return undefined;
  }

  /** Flips the toggle. Wired to the chip click and the responsive dialog's row. */
  flip(): void {
    if (this.disabled) {
      return;
    }
    this.on = !this.on;
    this.emitChange();
  }

  /** @see FilterPresenter.deselect — a toggle has no values to remove; `clear` turns it off. */
  deselect(): void {}

  clear(): void {
    if (this.on) {
      this.on = false;
      this.emitChange();
    }
  }

  setValue(value: unknown): void {
    this.on = !!value;
  }

  render() {
    const icon = this.on ? (this.iconActive ?? this.icon) : this.icon;
    return html`<div
      class="${filterChipClasses({
        size: this.size,
        selected: this.on,
        disabled: this.disabled,
        trailingIcon: false,
      })} ${chipPadding[this.size]}"
    >
      <button
        part="trigger"
        type="button"
        class="${triggerClasses} !tw-my-0 ${this.disabled ? "tw-cursor-not-allowed" : ""} ${
          this.showDisabledReason ? "tw-pointer-events-auto" : ""
        }"
        aria-pressed=${String(this.on)}
        ${ariaDisable(this.disabled)}
        aria-describedby=${this.showDisabledReason ? DISABLED_REASON_ID : nothing}
        ${tooltip(this.triggerTooltip)}
        @click=${() => this.flip()}
      >
        ${icon ? html`<bit-icon name=${icon} class="tw-text-base/5"></bit-icon>` : nothing}
        <span class="tw-text-start tw-truncate tw-leading-5 tw-min-w-0 tw-flex-1">
          <span class="tw-block tw-min-w-0 tw-truncate">${this.label}</span>
        </span>
      </button>
      ${this.renderDisabledReason()}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-filter-toggle": BitFilterToggle;
  }
}
