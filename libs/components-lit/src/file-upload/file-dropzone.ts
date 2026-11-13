import { html, nothing, PropertyValues } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";

import { t } from "../core/i18n";
import { announce } from "../core/live-announcer";
import { renderError } from "../form-field/error";
import { BitFieldElement, FieldRenderOptions } from "../form-field/field-element";
import { hintClasses } from "../form-field/field-styles";
import "../button/button";

import "./file-list";
import type { BitFileList } from "./file-list";

/**
 * Drag-and-drop file upload (Angular `bit-file-dropzone`). Its value is a `File[]` (`[]` = no
 * files); with a `name` the files are submitted with the enclosing form (`FormData`).
 *
 * Adding and removing files is announced to screen readers.
 *
 * Inherits the `label`, `hint` and `label-end` slots of `BitFieldElement`.
 *
 * @fires change - When files are added or removed.
 */
@customElement("bit-file-dropzone")
export class BitFileDropzone extends BitFieldElement<File[]> {
  @property({ attribute: false }) value: File[] = [];

  /**
   * Accepted file types, comma separated. Only a browser hint, not validation.
   */
  @property() accept = "";

  /** Maximum file size in MB, shown as a hint. Not validated. */
  @property({ type: Number, attribute: "max-file-size" }) maxFileSize?: number;

  @property({ type: Boolean, reflect: true }) multiple = false;

  @state() private dragOver = false;

  // Track drag enter/leave depth so dragging over child elements doesn't flicker the state.
  private dragDepth = 0;

  private pendingFocusIndex: number | null = null;

  @query("input[type=file]") private fileInput!: HTMLInputElement | null;

  @query("bit-file-list") private fileList!: BitFileList | null;

  protected get fieldOptions(): FieldRenderOptions {
    return { custom: true };
  }

  protected get validationTarget() {
    return this.fileInput ?? undefined;
  }

  /**
   * The visible instruction (the label is the input's name), hint, max-size text, error, and the
   * upload count status.
   */
  protected get describedBy() {
    return [
      "instructions",
      this.hasHint && !this.showErrors ? this.hintId : null,
      this.maxFileSize != null ? "size" : null,
      this.showErrors ? this.errorId : null,
      this.value.length > 0 ? "status" : null,
    ]
      .filter(Boolean)
      .join(" ");
  }

  protected toFormValue(files: File[]) {
    if (!this.name || !files?.length) {
      return null;
    }
    const data = new FormData();
    files.forEach((file) => data.append(this.name, file));
    return data;
  }

  formStateRestoreCallback(state: string | FormData | null) {
    this.value =
      state instanceof FormData
        ? state.getAll(this.name).filter((entry): entry is File => entry instanceof File)
        : [];
  }

  protected willUpdate(changed: PropertyValues) {
    if (changed.has("value") && !this.multiple && this.value.length > 1) {
      this.value = this.value.slice(0, 1);
    }
    super.willUpdate(changed);
  }

  protected updated(changed: PropertyValues) {
    super.updated(changed);
    if (this.pendingFocusIndex == null) {
      return;
    }
    const index = this.pendingFocusIndex;
    this.pendingFocusIndex = null;
    // After a removal, restore focus to the next delete button, or the dropzone when empty.
    if (this.value.length === 0) {
      this.fileInput?.focus();
    } else {
      void this.fileList?.updateComplete.then(() =>
        this.fileList?.focusDeleteAt(Math.min(index, this.value.length - 1)),
      );
    }
  }

  private onDropzoneClick = () => {
    if (!this.isDisabled) {
      this.fileInput?.click();
    }
  };

  private onInputClick = (event: MouseEvent) => {
    // The programmatic click from the dropzone would bubble back and re-open the picker.
    event.stopPropagation();
    if (this.isDisabled) {
      event.preventDefault();
      return;
    }
    // Reset at click time so re-selecting the same file still fires `change`.
    (event.target as HTMLInputElement).value = "";
  };

  private onInputChange = (event: Event) => {
    const files = (event.target as HTMLInputElement).files;
    if (!this.isDisabled && files?.length) {
      this.addFiles(Array.from(files));
    }
  };

  private onDragEnter = (event: DragEvent) => {
    // Cancel before the disabled check: an element only becomes a valid drop target if its
    // drag handlers call preventDefault. Skipping it on a disabled dropzone would let the
    // browser fall back to its default file-drop action and navigate the tab to the file.
    event.preventDefault();
    event.stopPropagation();
    if (this.isDisabled) {
      return;
    }
    this.dragDepth++;
    this.dragOver = true;
  };

  private onDragOver = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (this.isDisabled && event.dataTransfer) {
      // Keep the "not allowed" cursor so the disabled state still reads correctly.
      event.dataTransfer.dropEffect = "none";
    }
  };

  private onDragLeave = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (this.isDisabled) {
      return;
    }
    this.dragDepth--;
    if (this.dragDepth <= 0) {
      this.dragDepth = 0;
      this.dragOver = false;
    }
  };

  private onDrop = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    this.dragDepth = 0;
    this.dragOver = false;
    if (this.isDisabled || !event.dataTransfer?.files.length) {
      return;
    }
    this.addFiles(Array.from(event.dataTransfer.files));
  };

  private onRemove = (event: CustomEvent<File>) => {
    event.stopPropagation();
    if (this.isDisabled) {
      return;
    }
    const file = event.detail;
    const index = this.value.indexOf(file);
    if (index < 0) {
      return;
    }
    this.pendingFocusIndex = index;
    announce(t("fileRemoved", file.name), "assertive");
    this.setValue(this.value.filter((f) => f !== file));
  };

  private addFiles(newFiles: File[]) {
    const files = this.multiple ? newFiles : newFiles.slice(0, 1);
    this.touched = true;
    if (files.length === 1) {
      announce(t("fileAdded", files[0].name), "assertive");
    } else if (files.length > 1) {
      announce(
        t("filesAdded", String(files.length), files.map((f) => f.name).join(", ")),
        "assertive",
      );
    }
    this.setValue(this.multiple ? [...this.value, ...files] : files);
  }

  private get dropzoneClasses() {
    const base = [
      "tw-flex",
      "tw-flex-col",
      "tw-items-center",
      "tw-gap-4",
      "tw-py-10",
      "tw-border",
      "tw-border-dashed",
      "tw-rounded-xl",
      "tw-transition-colors",
      "tw-bg-bg-secondary",
      "focus-within:tw-border-transparent",
      "focus-within:tw-ring",
      "focus-within:tw-ring-offset-0",
      "focus-within:tw-ring-border-focus",
    ];
    if (this.isDisabled) {
      base.push("tw-text-fg-inactive", "tw-border-border-base", "!tw-cursor-not-allowed");
    } else if (this.showErrors) {
      base.push("tw-border-border-danger", "tw-cursor-pointer");
    } else if (this.dragOver) {
      base.push("!tw-bg-bg-quaternary", "tw-border-border-strong", "tw-cursor-pointer");
    } else {
      base.push("tw-border-border-strong", "tw-cursor-pointer", "hover:tw-bg-bg-quaternary");
    }
    return base.join(" ");
  }

  protected renderMessages() {
    // The hint renders between the drop area and the file list.
    return renderError(this.errorId, this.showErrors ? this.errorMessage : null, "tw-mt-2");
  }

  protected renderControl() {
    const disabled = this.isDisabled;
    const subtle = disabled ? "tw-text-fg-inactive" : "tw-text-fg-body-subtle";
    const count = this.value.length;
    const status =
      count === 0 ? "" : count === 1 ? t("oneFileUploaded") : t("filesUploaded", String(count));

    return html`<div>
      <div
        class=${this.dropzoneClasses}
        @click=${this.onDropzoneClick}
        @dragenter=${this.onDragEnter}
        @dragover=${this.onDragOver}
        @dragleave=${this.onDragLeave}
        @drop=${this.onDrop}
      >
        <input
          id=${this.controlId}
          type="file"
          class="tw-sr-only tw-pointer-events-none"
          accept=${this.accept || nothing}
          ?multiple=${this.multiple}
          ?disabled=${disabled}
          aria-describedby=${this.describedBy || nothing}
          aria-invalid=${this.showErrors ? "true" : nothing}
          @click=${this.onInputClick}
          @change=${this.onInputChange}
          @blur=${this.markTouchedOnBlur}
        />
        <div class="tw-flex tw-flex-col tw-items-center tw-gap-1">
          <span id="instructions" class="tw-text-sm tw-font-medium ${subtle}"
            >${t("clickToUploadOrDragAndDrop")}</span
          >
          ${
            this.maxFileSize != null
              ? html`<span id="size" class="tw-text-xs ${subtle}"
                  >${t("maxFileSizeParam", this.maxFileSize)}</span
                >`
              : nothing
          }
        </div>
        <bit-button
          button-type="primary"
          size="small"
          inert
          class="tw-pointer-events-none"
          ?disabled=${disabled}
          >${t("chooseFiles")}</bit-button
        >
      </div>
      <span id="status" class="tw-sr-only">${status}</span>
      <div id=${this.hintId} class="${hintClasses} tw-mt-2" ?hidden=${!this.hasHint}>
        <slot name="hint">${this.hint}</slot>
      </div>
      <bit-file-list
        .files=${this.value}
        ?disabled=${disabled}
        @fileRemoved=${this.onRemove}
      ></bit-file-list>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-file-dropzone": BitFileDropzone;
  }
}
