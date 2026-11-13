import { css, html, nothing } from "lit";
import { customElement, property, queryAll } from "lit/decorators.js";

import { BitElement } from "../core/bit-element";
import { t } from "../core/i18n";
import "../icon-tile/icon-tile";
import "../icon-button/icon-button";

import { renderFileName } from "./file-name";

export function formatFileSize(bytes: number): string {
  if (bytes === 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = bytes / Math.pow(k, i);
  return `${Number.isInteger(size) ? size : size.toFixed(1)} ${units[i]}`;
}

/**
 * List of attached files with name, size and a delete button. Used by `bit-file-dropzone`;
 * reusable wherever a removable file list is needed.
 *
 * @fires fileRemoved - When a delete button is clicked. `detail` is the `File`.
 */
@customElement("bit-file-list")
export class BitFileList extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: block;
      }
    `,
  ];

  @property({ attribute: false }) files: File[] = [];

  /** Hides the delete buttons. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  @queryAll("bit-icon-button") private deleteButtons!: NodeListOf<HTMLElement>;

  /** Focuses the delete button at `index`, if it exists. */
  focusDeleteAt(index: number) {
    this.deleteButtons[index]?.focus();
  }

  private removeFile(file: File) {
    this.dispatchEvent(
      new CustomEvent("fileRemoved", { detail: file, bubbles: true, composed: true }),
    );
  }

  render() {
    if (this.files.length === 0) {
      return nothing;
    }
    return html`<span id="label" class="tw-sr-only">${t("uploadedFiles")}</span>
      <ul aria-labelledby="label" class="tw-list-none tw-p-0 tw-m-0">
        ${this.files.map(
          (file) =>
            html`<li
              class="tw-flex tw-items-center tw-gap-3 tw-py-2 tw-border-0 tw-border-b tw-border-solid tw-border-border-light"
            >
              <bit-icon-tile icon="bwi-file" variant="gray" size="sm"></bit-icon-tile>
              <div class="tw-flex tw-flex-col tw-flex-1 tw-min-w-0">
                ${renderFileName(file.name)}
                <span class="tw-text-xs tw-text-muted">${formatFileSize(file.size)}</span>
              </div>
              ${
                this.disabled
                  ? nothing
                  : html`<bit-icon-button
                      icon="bwi-trash"
                      button-type="dangerGhost"
                      size="small"
                      label=${[t("delete"), file.name].join(" ")}
                      @click=${() => this.removeFile(file)}
                    ></bit-icon-button>`
              }
            </li>`,
        )}
      </ul>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-file-list": BitFileList;
  }
}
