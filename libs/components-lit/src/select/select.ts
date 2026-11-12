import { css, html, nothing, PropertyValues, unsafeCSS } from "lit";
import { customElement, property, query, queryAll, state } from "lit/decorators.js";

import { t } from "../core/i18n";
import { KeyManager } from "../core/key-manager";
import { BitFieldElement, FieldRenderOptions } from "../form-field/field-element";

import {
  ListboxPopup,
  listboxClasses,
  listboxCss,
  listboxPanelClasses,
  optionClasses,
  renderArrow,
  renderLeadingVisual,
} from "./listbox";
import type { SelectOption } from "./option";
import { BitOption, OPTION_CHANGE_EVENT } from "./option-element";

/**
 * Single-value select (Angular `<bit-form-field>` + `<bit-select>`), built as an ARIA select-only
 * combobox. Options come from `bit-option` children or the `items` property; children win when
 * both are present. Values are compared with `===`.
 *
 * Keyboard: Down/Up/Enter/Space/Home/End or typing open the list; arrows, Home/End and typeahead
 * move the active option; Enter/Space/Tab/Alt+Up select it; Escape closes without selecting.
 *
 * Inherits the slots and parts of `BitFieldElement`.
 *
 * @fires change - The user selected a different option.
 * @fires input - Same as `change`, for parity with a native `<select>`.
 * @fires closed - The listbox closed.
 */
@customElement("bit-select")
export class BitSelect<T = unknown> extends BitFieldElement<T | null | undefined> {
  static styles = [
    BitFieldElement.styles,
    css`
      ${unsafeCSS(listboxCss)}
    `,
  ];

  /** The selected value. From an attribute it is a string. */
  @property() value: T | null | undefined = undefined;

  /** Options as data. Ignored while `bit-option` children are present. */
  @property({ attribute: false }) items?: SelectOption<T>[];

  /** Shown when nothing is selected. Defaults to the `selectPlaceholder` translation. */
  @property() placeholder?: string;

  @state() private open = false;

  @state() private activeIndex = -1;

  @state() private childOptions: SelectOption<T>[] = [];

  @query("[role=combobox]") private combobox!: HTMLElement;

  @query("[part=container]") private container!: HTMLElement;

  @query(".listbox-panel") private panel!: HTMLElement;

  @queryAll("[role=option]") private optionEls!: NodeListOf<HTMLElement>;

  private readonly mutationObserver = new MutationObserver(() => this.readChildOptions());

  private readonly popup = new ListboxPopup({
    host: this,
    anchor: () => this.container,
    panel: () => this.panel,
    onDismiss: () => this.closeList(),
  });

  private readonly keyManager = new KeyManager<HTMLElement>({
    items: () => Array.from(this.optionEls),
    wrap: false,
    typeahead: true,
    focusItems: false,
    onActiveChange: (item, index) => {
      this.activeIndex = index;
      item?.scrollIntoView({ block: "nearest" });
    },
  });

  /** Effective options: from `bit-option` children, else `items`. */
  get options(): SelectOption<T>[] {
    return this.childOptions.length ? this.childOptions : (this.items ?? []);
  }

  get selectedOption(): SelectOption<T> | undefined {
    return this.options.find((option) => option.value === this.value);
  }

  protected get fieldOptions(): FieldRenderOptions {
    return { flush: true };
  }

  protected get validationTarget() {
    return this.combobox ?? undefined;
  }

  connectedCallback() {
    super.connectedCallback();
    this.readChildOptions();
    this.mutationObserver.observe(this, { childList: true });
    this.addEventListener(OPTION_CHANGE_EVENT, this.readChildOptions);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.mutationObserver.disconnect();
    this.removeEventListener(OPTION_CHANGE_EVENT, this.readChildOptions);
    this.popup.hide();
    this.open = false;
  }

  protected firstUpdated(changed: PropertyValues) {
    super.firstUpdated(changed);
    // The combobox isn't a labelable element, so the label's `for` doesn't focus it.
    this.renderRoot
      .querySelector("label")
      ?.addEventListener("click", () => !this.isDisabled && this.combobox.focus());
  }

  protected updated(changed: PropertyValues) {
    super.updated(changed);
    if (this.open && this.isDisabled) {
      this.closeList();
    }
  }

  private readChildOptions = () => {
    this.childOptions = Array.from(
      this.querySelectorAll<BitOption<T>>(":scope > bit-option"),
      (option) => option.toOption(),
    );
  };

  private async openList(position: "selected" | "first" | "last" = "selected") {
    if (this.open || this.isDisabled) {
      return;
    }
    this.open = true;
    await this.updateComplete;
    this.popup.show();
    const selectedIndex = this.options.findIndex((option) => option === this.selectedOption);
    if (position === "last") {
      this.keyManager.setLastItemActive();
    } else if (position === "selected" && selectedIndex >= 0) {
      this.keyManager.setActiveItem(selectedIndex);
    } else {
      this.keyManager.setFirstItemActive();
    }
  }

  private closeList() {
    if (!this.open) {
      return;
    }
    this.open = false;
    this.activeIndex = -1;
    this.popup.hide();
    this.dispatchEvent(new CustomEvent("closed", { bubbles: true, composed: true }));
  }

  private choose(index: number) {
    const option = this.options[index];
    if (!option || option.disabled) {
      return;
    }
    if (option.value !== this.value) {
      this.setValue(option.value);
      this.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    }
    this.closeList();
  }

  private onKeydown = async (event: KeyboardEvent) => {
    if (this.isDisabled) {
      return;
    }
    const { key, altKey, ctrlKey, metaKey } = event;
    if (!this.open) {
      if (key === "ArrowDown" || key === "ArrowUp" || key === "Enter" || key === " ") {
        event.preventDefault();
        await this.openList();
      } else if (key === "Home" || key === "End") {
        event.preventDefault();
        await this.openList(key === "Home" ? "first" : "last");
      } else if (key.length === 1 && !ctrlKey && !metaKey && !altKey) {
        event.preventDefault();
        await this.openList();
        this.keyManager.onKeydown(event);
      }
      return;
    }

    switch (key) {
      case "Escape":
        // Keeps an enclosing dialog from also closing.
        event.preventDefault();
        this.closeList();
        return;
      case "Tab":
        this.choose(this.activeIndex);
        this.closeList();
        return;
      case "Enter":
        event.preventDefault();
        this.choose(this.activeIndex);
        return;
      case " ":
        event.preventDefault();
        this.choose(this.activeIndex);
        return;
      case "ArrowUp":
        if (altKey) {
          event.preventDefault();
          this.choose(this.activeIndex);
          return;
        }
        break;
    }
    if (this.keyManager.onKeydown(event)) {
      event.preventDefault();
    }
  };

  private onComboboxClick = () => {
    if (this.open) {
      this.closeList();
    } else {
      void this.openList();
    }
  };

  private onBlur = () => {
    this.closeList();
    this.markTouchedOnBlur();
  };

  private renderValue() {
    const selected = this.selectedOption;
    if (!selected) {
      return html`<span class="tw-block tw-truncate tw-text-fg-body-subtle"
        >${this.placeholder ?? t("selectPlaceholder")}</span
      >`;
    }
    return html`<div
      class="tw-flex tw-items-center tw-gap-2 tw-min-w-0"
      title=${selected.label ?? nothing}
    >
      ${renderLeadingVisual(selected)}
      <span class="tw-truncate" data-testid="bit-select-value">${selected.label}</span>
    </div>`;
  }

  private renderOption(option: SelectOption<T>, index: number) {
    const selected = option === this.selectedOption;
    const disabled = !!option.disabled;
    return html`<div
      id="option-${index}"
      role="option"
      aria-selected=${selected ? "true" : "false"}
      aria-disabled=${disabled ? "true" : nothing}
      class=${optionClasses({ selected, active: index === this.activeIndex, disabled })}
      title=${option.label ?? nothing}
      @pointermove=${() => !disabled && index !== this.activeIndex && this.keyManager.setActiveItem(index)}
      @click=${() => this.choose(index)}
    >
      <div class="tw-flex tw-justify-between tw-items-center tw-gap-2">
        <div class="tw-flex tw-items-center tw-gap-2 tw-flex-1 tw-min-w-0">
          <div class="tw-flex-initial tw-self-center">${renderLeadingVisual(option)}</div>
          <div class="tw-flex tw-flex-col tw-min-w-0">
            <div class="tw-text-sm tw-leading-5 tw-flex-1 tw-text-ellipsis tw-overflow-hidden">
              ${option.label}
            </div>
            ${
              option.description
                ? html`<div class="tw-text-xs tw-text-fg-body tw-font-normal tw-truncate">
                    ${option.description}
                  </div>`
                : nothing
            }
          </div>
        </div>
        ${option.metaData ? html`<div class="tw-text-xs">${option.metaData}</div>` : nothing}
      </div>
    </div>`;
  }

  protected renderControl() {
    const disabled = this.isDisabled;
    const options = this.options;
    return html`<div
        id=${this.controlId}
        role="combobox"
        tabindex=${disabled ? "-1" : "0"}
        aria-labelledby="label"
        aria-controls="listbox"
        aria-haspopup="listbox"
        aria-expanded=${this.open ? "true" : "false"}
        aria-activedescendant=${this.open && this.activeIndex >= 0 ? `option-${this.activeIndex}` : nothing}
        aria-describedby=${this.describedBy ?? nothing}
        aria-invalid=${this.showErrors ? "true" : nothing}
        aria-required=${this.required ? "true" : nothing}
        aria-disabled=${disabled ? "true" : nothing}
        class="tw-flex tw-items-center tw-size-full tw-min-w-0 tw-ps-3 tw-py-[7px] tw-outline-none ${
          disabled
            ? "tw-text-fg-inactive tw-cursor-default"
            : "tw-text-fg-heading tw-cursor-pointer"
        }"
        @click=${disabled ? nothing : this.onComboboxClick}
        @keydown=${this.onKeydown}
        @blur=${this.onBlur}
      >
        <div class="tw-flex-1 tw-min-w-0">${this.renderValue()}</div>
        ${renderArrow(this.open)}
      </div>
      <div
        class="listbox-panel"
        popover="manual"
        @pointerdown=${(event: PointerEvent) => event.preventDefault()}
      >
        <div class=${listboxPanelClasses}>
          <div id="listbox" role="listbox" aria-labelledby="label" class=${listboxClasses}>
            ${
              this.open
                ? options.length
                  ? options.map((option, i) => this.renderOption(option, i))
                  : html`<div class="tw-p-2 tw-text-fg-body-subtle">
                      ${t("multiSelectNotFound")}
                    </div>`
                : nothing
            }
          </div>
        </div>
      </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-select": BitSelect;
  }
}
