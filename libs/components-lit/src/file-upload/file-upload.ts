import { html, nothing } from "lit";
import { customElement, property, query } from "lit/decorators.js";

import { t } from "../core/i18n";
import { BitFieldElement } from "../form-field/field-element";

import { renderFileName } from "./file-name";

/**
 * Single-file picker in a form field (Angular `bit-file-upload`). Its value is a `File` or `null`;
 * with a `name` the file is submitted with the enclosing form (`FormData`). For multiple files use
 * `bit-file-dropzone`.
 *
 * Inherits the slots and parts of `BitFieldElement`.
 *
 * @fires change - When the user picks a file.
 */
@customElement("bit-file-upload")
export class BitFileUpload extends BitFieldElement<File | null> {
  @property({ attribute: false }) value: File | null = null;

  /**
   * Accepted file types, comma separated (e.g. `"image/*"`, `".pdf,.doc"`). Only a browser hint,
   * not validation.
   */
  @property() accept = "";

  @query("input[type=file]") private fileInput!: HTMLInputElement | null;

  @query("#control") private button!: HTMLButtonElement | null;

  protected get validationTarget() {
    return this.button ?? undefined;
  }

  protected get describedBy() {
    return [super.describedBy, "status"].filter(Boolean).join(" ");
  }

  protected toFormValue(file: File | null) {
    if (!file || !this.name) {
      return null;
    }
    const data = new FormData();
    data.append(this.name, file);
    return data;
  }

  formStateRestoreCallback(state: string | FormData | null) {
    const file = state instanceof FormData ? state.get(this.name) : null;
    this.value = file instanceof File ? file : null;
  }

  private openPicker = () => {
    if (this.isDisabled || !this.fileInput) {
      return;
    }
    this.fileInput.value = ""; // clear before opening so the same file can be re-selected
    this.fileInput.click();
  };

  private onFileChange = (event: Event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) {
      return;
    }
    this.touched = true;
    this.setValue(file);
  };

  protected renderStart() {
    const disabled = this.isDisabled;
    return html`<button
      id=${this.controlId}
      type="button"
      class="tw-whitespace-nowrap tw-border-0 tw-bg-transparent tw-py-2 tw-text-sm tw-cursor-pointer aria-disabled:tw-cursor-not-allowed focus-visible:tw-outline-none ${
        disabled ? "tw-text-fg-inactive" : "tw-text-current"
      }"
      aria-describedby=${this.describedBy || nothing}
      aria-disabled=${disabled ? "true" : nothing}
      aria-invalid=${this.showErrors ? "true" : nothing}
      @click=${this.openPicker}
      @blur=${this.markTouchedOnBlur}
    >
      ${t("chooseFile")}
    </button>`;
  }

  protected renderControl() {
    const disabled = this.isDisabled;
    const fileName = this.value?.name;
    // The filename readout is clickable so the whole field opens the picker; keyboard access is
    // provided by the "Choose file" button.
    return html`<div
        class="tw-flex tw-size-full tw-items-center ${
          disabled ? "tw-cursor-not-allowed" : "tw-cursor-pointer"
        }"
        @click=${this.openPicker}
      >
        ${
          fileName
            ? renderFileName(fileName)
            : html`<span
                class="tw-text-sm ${disabled ? "tw-text-fg-inactive" : "tw-text-fg-body-subtle"}"
                >${t("noFileSelected")}</span
              >`
        }
      </div>
      <input
        type="file"
        class="tw-sr-only"
        tabindex="-1"
        aria-hidden="true"
        accept=${this.accept || nothing}
        ?disabled=${disabled}
        @change=${this.onFileChange}
      />
      <span id="status" class="tw-sr-only" aria-live="polite" aria-atomic="true"
        >${fileName ? t("fileChosen", fileName) : t("chooseFile")}</span
      >`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-file-upload": BitFileUpload;
  }
}
