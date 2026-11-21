import { css, html, nothing } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { live } from "lit/directives/live.js";

import { BitElement } from "../core/bit-element";
import { BitFormControlElement } from "../core/form-control";
import { t } from "../core/i18n";
import { FieldSize, fieldContainerClasses } from "../form-field/field-styles";
import "../icon-button/icon-button";
import "../kbd/kbd";

// Safari renders `type="search"` slowly; it uses `type="text"` instead.
const isSafari = () => /^((?!chrome|android|crios|fxios).)*safari/i.test(navigator.userAgent);

/**
 * Search field with a clear button (Angular `bit-search`). Esc clears the field; with
 * `use-key-shortcuts`, ⌘/Ctrl+F focuses it and shortcut hints are shown.
 *
 * It renders its own `<form role="search">`, so it can sit inside another form. With a `name`, its
 * value is submitted with an enclosing form.
 *
 * @fires input - On every keystroke and when cleared.
 * @fires change - When the value is committed or cleared.
 */
@customElement("bit-search")
export class BitSearch extends BitFormControlElement<string> {
  static shadowRootOptions = { ...BitElement.shadowRootOptions, delegatesFocus: true };

  static styles = [
    BitElement.styles,
    css`
      :host {
        display: block;
      }
      /* Hide the browser's own clear button; ours works in all browsers. */
      input[type="search"]::-webkit-search-cancel-button {
        -webkit-appearance: none;
        appearance: none;
      }
    `,
  ];

  @property() value = "";

  /** Defaults to "Search". */
  @property() placeholder?: string;

  @property() autocomplete?: string;

  @property({ reflect: true }) size: FieldSize = "base";

  /**
   * Enables the ⌘/Ctrl+F focus shortcut and shows shortcut hints. Esc clears the field regardless.
   * The shortcut is ignored while a modal dialog other than the one containing this search is open.
   */
  @property({ type: Boolean, attribute: "use-key-shortcuts" }) useKeyShortcuts = false;

  @state() private focusVisible = false;

  @query("input") private input!: HTMLInputElement | null;

  protected get validationTarget() {
    return this.input ?? undefined;
  }

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener("keydown", this.onDocumentKeyDown);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("keydown", this.onDocumentKeyDown);
  }

  /** Clears the value and returns focus to the input. */
  clear() {
    this.value = "";
    this.dirty = true;
    this.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    this.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    // Return focus to the input since the clear button is about to be removed.
    this.input?.focus();
  }

  private onDocumentKeyDown = (event: KeyboardEvent) => {
    if (!this.useKeyShortcuts || this.isDisabled) {
      return;
    }
    // Cmd+F (Mac) or Ctrl+F (Win/Linux) — exactly one of metaKey/ctrlKey
    if (event.key.toLowerCase() !== "f" || event.metaKey === event.ctrlKey) {
      return;
    }
    // Content behind a modal dialog is inert and can't take focus; leave the shortcut to the
    // browser's find (or to a search inside the dialog) in that case.
    this.input?.focus();
    if (this.shadowRoot?.activeElement === this.input) {
      event.preventDefault();
    }
  };

  // Safari uses type="text", losing the native clear. Stopping propagation keeps Escape one
  // action: an enclosing overlay only closes on a second press, once there's nothing left to clear.
  private onKeyDown = (event: KeyboardEvent) => {
    const modified = event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
    if (event.key !== "Escape" || modified || !this.value) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.clear();
  };

  private onInput = (event: Event) => {
    this.value = (event.target as HTMLInputElement).value;
    this.dirty = true;
  };

  private onFocusIn = (event: FocusEvent) => {
    const target = event.composedPath()[0];
    this.focusVisible = target === this.input && this.input.matches(":focus-visible");
  };

  render() {
    const disabled = this.isDisabled;
    const shortcuts = this.useKeyShortcuts && !disabled;
    const container = [
      fieldContainerClasses({
        size: this.size,
        hasError: false,
        readOnly: false,
        disabled,
        focusVisible: this.focusVisible,
      }),
      "tw-items-center tw-ps-3 tw-pe-1",
    ].join(" ");

    return html`<form
      part="container"
      role="search"
      class=${container}
      @keydown=${this.onKeyDown}
      @submit=${(event: Event) => event.preventDefault()}
      @focusin=${this.onFocusIn}
      @focusout=${() => (this.focusVisible = false)}
    >
      <!-- Covers the field so clicks anywhere focus the input -->
      <label class="tw-absolute tw-inset-0 tw-cursor-text" for="control">
        <span class="tw-sr-only">${t("search")}</span>
      </label>
      <i class="bwi bwi-search ${disabled ? "tw-text-fg-inactive" : ""}" aria-hidden="true"></i>
      <!-- tw-size-full keeps the placeholder pixel-stable; tw-relative lifts it above the label -->
      <input
        id="control"
        type=${isSafari() ? "text" : "search"}
        name="searchText"
        class="tw-relative tw-block tw-size-full tw-bg-transparent tw-text-fg-heading tw-placeholder-fg-body-subtle tw-border-none focus:tw-outline-none disabled:tw-bg-bg-inactive disabled:!tw-placeholder-fg-inactive disabled:!tw-text-fg-inactive tw-ps-2 tw-pe-1"
        placeholder=${this.placeholder ?? t("search")}
        .value=${live(this.value ?? "")}
        ?disabled=${disabled}
        autocomplete=${this.autocomplete ?? nothing}
        aria-keyshortcuts=${shortcuts ? "Control+f Meta+f" : nothing}
        @input=${this.onInput}
        @change=${() => this.dispatchEvent(new Event("change", { bubbles: true, composed: true }))}
        @blur=${this.markTouchedOnBlur}
      />
      ${
        shortcuts && !this.value
          ? html`<span
                class="tw-flex tw-items-center tw-gap-1 tw-pe-1 tw-shrink-0 tw-select-none group-has-[input:focus]/form-field:tw-hidden"
                aria-hidden="true"
                ><bit-kbd .keys=${["modifier", "F"]}></bit-kbd
              ></span>
              <span
                class="tw-hidden tw-items-center tw-gap-1 tw-pe-1 tw-shrink-0 tw-select-none group-has-[input:focus]/form-field:tw-flex"
                aria-hidden="true"
                ><bit-kbd .keys=${["Esc"]}></bit-kbd
              ></span>`
          : nothing
      }
      ${
        this.value
          ? html`<bit-icon-button
              icon="bwi-clear"
              size="small"
              label=${t("resetSearch")}
              tooltip=${t("clearSearchTooltip")}
              @click=${() => this.clear()}
            ></bit-icon-button>`
          : nothing
      }
    </form>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-search": BitSearch;
  }
}
