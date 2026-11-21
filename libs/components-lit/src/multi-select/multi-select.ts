import { css, html, nothing, PropertyValues, TemplateResult, unsafeCSS } from "lit";
import { customElement, property, query, queryAll, state } from "lit/decorators.js";
import { live } from "lit/directives/live.js";

import "../chips/chip/chip";
import { t } from "../core/i18n";
import { KeyManager } from "../core/key-manager";
import { BitFieldElement, FieldRenderOptions } from "../form-field/field-element";
import "../icon/icon";
import { BitwardenIcon } from "../icon/shared-icon";
import {
  ListboxPopup,
  listboxClasses,
  listboxCss,
  listboxPanelClasses,
  matchesSearch,
  optionClasses,
  renderArrow,
  renderLeadingVisual,
} from "../select/listbox";
import "../spinner/spinner";

import type { SelectItemView } from "./select-item-view";

type Group = { label?: string; items: SelectItemView[] };

/** Groups by `parentGrouping` in order of first appearance; ungrouped items render without a header. */
function groupItems(items: SelectItemView[]): Group[] {
  const groups = new Map<string | undefined, SelectItemView[]>();
  for (const item of items) {
    const key = item.parentGrouping || undefined;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return Array.from(groups, ([label, groupItems]) => ({ label, items: groupItems }));
}

/**
 * Multi-value select with search (Angular `<bit-form-field>` + `<bit-multi-select>`), built as an
 * ARIA combobox with a multi-selectable listbox. Selected items render as chips.
 *
 * The list stays open while items are toggled; closing it (Escape excepted, which discards the
 * selection) confirms the selection through `itemsConfirmed`.
 *
 * Keyboard: Down/Up open the list and move the active option; Enter toggles it; typing filters;
 * Backspace in an empty search removes the last chip; Escape clears the selection and closes.
 *
 * Inherits the slots and parts of `BitFieldElement`.
 *
 * @fires change - The selection changed.
 * @fires itemsConfirmed - `CustomEvent<SelectItemView[]>` when the list closes with a selection
 *   (Angular `onItemsConfirmed`).
 * @fires baseItemsChange - `CustomEvent<SelectItemView[]>` when `remove-selected-items` removed
 *   confirmed items from `baseItems`.
 */
@customElement("bit-multi-select")
export class BitMultiSelect extends BitFieldElement<SelectItemView[]> {
  static styles = [
    BitFieldElement.styles,
    css`
      ${unsafeCSS(listboxCss)}
      .clear {
        width: 24px;
        min-width: 24px;
        height: 24px;
        border-radius: 12px;
        border: 2px solid transparent;
        background: transparent;
        color: var(--color-fg-heading);
        cursor: pointer;
      }
      .clear:hover,
      .clear:focus-visible {
        border-color: var(--color-fg-heading);
        outline: none;
      }
      .clear span {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        border: 2px solid;
        font-size: 12px;
        line-height: 1;
      }
    `,
  ];

  /** The selected items, compared by `id`. */
  @property({ attribute: false }) value: SelectItemView[] = [];

  /** The selectable items. Pass only selectable ones (complete list minus already-assigned). */
  @property({ attribute: false }) baseItems: SelectItemView[] = [];

  /** Remove confirmed items from `baseItems` and clear the selection when the list closes. */
  @property({ type: Boolean, attribute: "remove-selected-items" }) removeSelectedItems = false;

  /** Shown when nothing is selected. Defaults to the `multiSelectPlaceholder` translation. */
  @property() placeholder?: string;

  /** Shows a spinner, and the loading text while there are no items. */
  @property({ type: Boolean, reflect: true }) loading = false;

  @state() private open = false;

  @state() private search = "";

  @state() private activeIndex = -1;

  @query("input") private input!: HTMLInputElement;

  @query("[part=container]") private container!: HTMLElement;

  @query(".listbox-panel") private panel!: HTMLElement;

  @queryAll("[role=option]") private optionEls!: NodeListOf<HTMLElement>;

  private readonly popup = new ListboxPopup({
    host: this,
    anchor: () => this.container,
    panel: () => this.panel,
    onDismiss: () => this.closeList(),
  });

  private readonly keyManager = new KeyManager<HTMLElement>({
    items: () => Array.from(this.optionEls),
    wrap: false,
    focusItems: false,
    onActiveChange: (item, index) => {
      this.activeIndex = index;
      item?.scrollIntoView({ block: "nearest" });
    },
  });

  /** Filtered options, in the order they render (ungrouped first by appearance, then groups). */
  private get groups(): Group[] {
    const term = this.search.trim();
    const items = term
      ? this.baseItems.filter((item) => matchesSearch(item.listName, term))
      : this.baseItems;
    return groupItems(items);
  }

  private get flatOptions(): SelectItemView[] {
    return this.groups.flatMap((group) => group.items);
  }

  protected get fieldOptions(): FieldRenderOptions {
    return { flush: true };
  }

  protected get validationTarget() {
    return this.input ?? undefined;
  }

  protected toFormValue(value: SelectItemView[]) {
    const data = new FormData();
    (value ?? []).forEach((item) => data.append(this.name, item.id));
    return data;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.popup.hide();
    this.open = false;
  }

  protected updated(changed: PropertyValues) {
    super.updated(changed);
    if (this.open && this.isDisabled) {
      this.closeList();
    }
  }

  private isSelected(item: SelectItemView) {
    return (this.value ?? []).some((selected) => selected.id === item.id);
  }

  private async openList() {
    if (this.open || this.isDisabled) {
      return;
    }
    this.open = true;
    await this.updateComplete;
    this.popup.show();
    this.keyManager.setFirstItemActive();
  }

  /** Closing is the user's signal that the selection is complete. */
  private closeList({ confirm = true } = {}) {
    if (!this.open) {
      return;
    }
    this.open = false;
    this.search = "";
    this.activeIndex = -1;
    this.popup.hide();

    const items = this.value ?? [];
    if (!confirm || items.length === 0) {
      return;
    }
    this.dispatchEvent(
      new CustomEvent<SelectItemView[]>("itemsConfirmed", {
        detail: items,
        bubbles: true,
        composed: true,
      }),
    );
    if (this.removeSelectedItems) {
      const ids = new Set(items.map((item) => item.id));
      this.baseItems = this.baseItems.filter((item) => !ids.has(item.id));
      this.setValue([]);
      this.dispatchEvent(
        new CustomEvent<SelectItemView[]>("baseItemsChange", {
          detail: this.baseItems,
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  private toggle(item: SelectItemView) {
    const current = this.value ?? [];
    if (this.isSelected(item)) {
      this.setValue(current.filter((selected) => selected.id !== item.id));
    } else {
      this.setValue([...current, item]);
      this.search = "";
    }
  }

  private removeItem(item: SelectItemView) {
    this.setValue((this.value ?? []).filter((selected) => selected.id !== item.id));
    this.input?.focus();
  }

  private clearAll = () => {
    this.setValue([]);
    this.input?.focus();
  };

  private onKeydown = async (event: KeyboardEvent) => {
    if (this.isDisabled) {
      return;
    }
    const { key } = event;
    if (key === "Backspace" && !this.search && (this.value ?? []).length > 0) {
      this.setValue(this.value.slice(0, -1));
      return;
    }
    if (!this.open) {
      if (key === "ArrowDown" || key === "ArrowUp") {
        event.preventDefault();
        await this.openList();
      }
      return;
    }
    switch (key) {
      case "Escape":
        // Discards the selection, and keeps an enclosing dialog from also closing.
        event.preventDefault();
        this.setValue([]);
        this.closeList({ confirm: false });
        return;
      case "Tab":
        this.closeList();
        return;
      case "Enter": {
        event.preventDefault();
        const item = this.flatOptions[this.activeIndex];
        if (item) {
          this.toggle(item);
        }
        return;
      }
      case "ArrowDown":
      case "ArrowUp":
        event.preventDefault();
        this.keyManager.onKeydown(event);
        return;
    }
  };

  private onInput = async (event: Event) => {
    this.search = (event.target as HTMLInputElement).value;
    if (!this.open) {
      await this.openList();
    } else {
      await this.updateComplete;
      this.keyManager.setFirstItemActive();
    }
  };

  private onBlur = () => {
    this.closeList();
    this.markTouchedOnBlur();
  };

  private onContainerClick = (event: MouseEvent) => {
    if (this.isDisabled) {
      return;
    }
    // Chips handle their own clicks.
    if (event.composedPath().some((el) => (el as Element).localName === "bit-chip")) {
      return;
    }
    this.input.focus();
    if (this.open && event.composedPath()[0] !== this.input) {
      this.closeList();
    } else {
      void this.openList();
    }
  };

  private renderOption(item: SelectItemView, index: number, child: boolean) {
    const selected = this.isSelected(item);
    return html`<div
      id="option-${index}"
      role="option"
      aria-selected=${selected ? "true" : "false"}
      class="${optionClasses({ selected, active: index === this.activeIndex, disabled: false })} ${
        child ? "tw-ps-[22px]" : ""
      }"
      @pointermove=${() => index !== this.activeIndex && this.keyManager.setActiveItem(index)}
      @click=${() => this.toggle(item)}
    >
      <div class="tw-flex tw-items-center">
        <div class="tw-w-7 tw-flex-none">
          ${selected ? html`<bit-icon name="bwi-check"></bit-icon>` : nothing}
        </div>
        <div class="tw-me-2 tw-flex-initial">
          ${renderLeadingVisual({ icon: item.icon, iconTile: item.iconTile })}
        </div>
        <div class="tw-flex-1 tw-min-w-0 tw-truncate" title=${item.listName}>${item.listName}</div>
      </div>
    </div>`;
  }

  private renderListOptions() {
    let index = 0;
    const rows: TemplateResult[] = [];
    this.groups.forEach((group, groupIndex) => {
      const options = group.items.map((item) =>
        this.renderOption(item, index++, group.label != null),
      );
      if (group.label == null) {
        rows.push(...options);
        return;
      }
      rows.push(
        html`<div
          role="group"
          aria-labelledby="group-${groupIndex}"
          class="tw-flex tw-flex-col tw-gap-1"
        >
          <div
            id="group-${groupIndex}"
            class="tw-py-2 tw-px-2.5 tw-font-medium tw-text-muted tw-select-none"
          >
            ${group.label}
          </div>
          ${options}
        </div>`,
      );
    });
    if (rows.length) {
      return rows;
    }
    return html`<div class="tw-p-2 tw-text-fg-body-subtle">
      ${this.loading ? t("multiSelectLoading") : t("multiSelectNotFound")}
    </div>`;
  }

  protected renderControl() {
    const disabled = this.isDisabled;
    const values = this.value ?? [];
    const placeholder = this.placeholder ?? t("multiSelectPlaceholder");
    return html`<div
        class="tw-flex tw-items-center tw-size-full tw-min-w-0 ${
          disabled ? "tw-text-fg-inactive" : "tw-text-fg-heading tw-cursor-text"
        }"
        @click=${this.onContainerClick}
      >
        <div
          class="tw-flex tw-flex-1 tw-flex-wrap tw-items-center tw-gap-y-1 tw-min-w-0 tw-ps-3 tw-py-[3px]"
        >
          ${values.map(
            (item) =>
              html`<bit-chip
                size="small"
                class="tw-me-1"
                label=${item.labelName}
                start-icon=${(item.icon as BitwardenIcon) ?? nothing}
                ?disabled=${disabled}
                @dismissed=${() => this.removeItem(item)}
              ></bit-chip>`,
          )}
          <input
            id=${this.controlId}
            role="combobox"
            type="text"
            autocomplete="off"
            class="tw-flex-1 tw-min-w-16 tw-p-0 tw-border-none tw-bg-transparent tw-outline-none tw-text-fg-heading placeholder:tw-text-fg-body-subtle disabled:tw-text-fg-inactive"
            .value=${live(this.search)}
            placeholder=${values.length ? nothing : placeholder}
            aria-autocomplete="list"
            aria-controls="listbox"
            aria-haspopup="listbox"
            aria-expanded=${this.open ? "true" : "false"}
            aria-activedescendant=${
              this.open && this.activeIndex >= 0 ? `option-${this.activeIndex}` : nothing
            }
            aria-describedby=${this.describedBy ?? nothing}
            aria-invalid=${this.showErrors ? "true" : nothing}
            aria-required=${this.required ? "true" : nothing}
            ?disabled=${disabled}
            @keydown=${this.onKeydown}
            @input=${this.onInput}
            @blur=${this.onBlur}
          />
        </div>
        ${
          this.loading
            ? html`<bit-spinner size="sm" class="tw-flex tw-shrink-0 tw-me-1"></bit-spinner>`
            : nothing
        }
        ${
          values.length && !disabled
            ? html`<button
                type="button"
                class="clear tw-flex tw-shrink-0 tw-items-center tw-justify-center tw-me-2 tw-p-0"
                title=${t("multiSelectClearAll")}
                aria-label=${t("multiSelectClearAll")}
                @pointerdown=${(event: PointerEvent) => event.preventDefault()}
                @click=${(event: MouseEvent) => {
                  event.stopPropagation();
                  this.clearAll();
                }}
              >
                <span aria-hidden="true">×</span>
              </button>`
            : nothing
        }
        ${renderArrow(this.open)}
      </div>
      <div
        class="listbox-panel"
        popover="manual"
        @pointerdown=${(event: PointerEvent) => event.preventDefault()}
      >
        <div class=${listboxPanelClasses}>
          <div
            id="listbox"
            role="listbox"
            aria-multiselectable="true"
            aria-labelledby="label"
            class=${listboxClasses}
          >
            ${this.open ? this.renderListOptions() : nothing}
          </div>
        </div>
      </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-multi-select": BitMultiSelect;
  }
}
