import { html, nothing } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";

import "../button/button";
import { runAsyncAction } from "../core/async-action";
import { BitElement } from "../core/bit-element";
import { t } from "../core/i18n";

import { AutofocusFallbackHost, DialogRef } from "./dialog-ref";
import "./simple-dialog";
import type { BitSimpleDialog } from "./simple-dialog";
import { SimpleDialogOptions, SimpleDialogType, Translation } from "./simple-dialog-types";

const DEFAULT_ICON: Record<SimpleDialogType, string> = {
  primary: "bwi-business",
  success: "bwi-star",
  info: "bwi-info-circle",
  warning: "bwi-exclamation-triangle",
  danger: "bwi-error",
};

const DEFAULT_COLOR: Record<SimpleDialogType, string> = {
  primary: "tw-text-primary-600",
  success: "tw-text-success",
  info: "tw-text-info",
  warning: "tw-text-warning",
  danger: "tw-text-danger",
};

function translate(value: string | Translation): string {
  return typeof value === "object" ? t(value.key, ...(value.placeholders ?? [])) : value;
}

/**
 * Content for `openSimpleDialog`.
 *
 * @internal
 */
@customElement("bit-simple-configurable-dialog")
export class BitSimpleConfigurableDialog extends BitElement implements AutofocusFallbackHost {
  @property({ attribute: false }) dialogRef?: DialogRef<boolean, SimpleDialogOptions>;

  @property({ attribute: false }) data!: SimpleDialogOptions;

  @state() private submitting = false;

  @query("bit-simple-dialog") private simpleDialog?: BitSimpleDialog;

  autofocusFallback() {
    return this.simpleDialog?.autofocusFallback();
  }

  private accept = async (event: Event) => {
    event.preventDefault();
    if (this.submitting) {
      return;
    }
    let succeeded = false;
    await runAsyncAction(
      async () => {
        await this.data.acceptAction?.();
        succeeded = true;
      },
      (loading) => (this.submitting = loading),
    );
    if (succeeded && !this.data.disableClose) {
      void this.dialogRef?.close(true);
    }
  };

  render() {
    const opts = this.data;
    const showCancel = opts.cancelButtonText !== null;
    const cancelText = showCancel
      ? translate(
          opts.cancelButtonText ??
            (opts.acceptButtonText !== undefined ? { key: "cancel" } : { key: "no" }),
        )
      : "";
    const iconClasses = `bwi tw-text-3xl ${opts.icon ?? DEFAULT_ICON[opts.type]} ${DEFAULT_COLOR[opts.type]}`;

    return html`<form @submit=${this.accept}>
      <bit-simple-dialog ?hide-icon=${opts.hideIcon ?? false}>
        <i slot="icon" class=${iconClasses} aria-hidden="true"></i>
        <span slot="title">${translate(opts.title)}</span>
        <div>${translate(opts.content)}</div>
        <bit-button
          slot="footer"
          block
          type="submit"
          button-type=${opts.type === "danger" ? "danger" : "primary"}
          ?loading=${this.submitting}
        >
          ${translate(opts.acceptButtonText ?? { key: "yes" })}
        </bit-button>
        ${
          showCancel
            ? html`<bit-button
                slot="footer"
                block
                button-type="secondary"
                ?disabled=${this.submitting}
                @click=${() => void this.dialogRef?.close(false)}
              >
                ${cancelText}
              </bit-button>`
            : nothing
        }
      </bit-simple-dialog>
    </form>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-simple-configurable-dialog": BitSimpleConfigurableDialog;
  }
}
