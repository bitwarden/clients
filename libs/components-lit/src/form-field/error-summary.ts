import { css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { BitElement } from "../core/bit-element";
import { t } from "../core/i18n";

type ControlState = {
  errors: Record<string, unknown> | null;
  dirty: boolean;
  touched: boolean;
  showErrors: boolean;
};

const isBitControl = (el: Element): el is Element & ControlState =>
  "errors" in el && "showErrors" in el;

const FORM_EVENTS = ["input", "change", "focusout", "submit", "reset"] as const;

/**
 * Summarizes the number of errors in a native `<form>` (Angular `bit-error-summary`). Counts
 * errors of form-associated `bit-*` controls that are dirty, touched or submitted, and native
 * controls that are invalid after a submit attempt.
 */
@customElement("bit-error-summary")
export class BitErrorSummary extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: block;
      }
    `,
  ];

  /** The form to summarize. Defaults to the closest ancestor `<form>`. */
  @property({ attribute: false }) form?: HTMLFormElement;

  @state() private errorCount = 0;

  private observed?: HTMLFormElement;
  private submitted = false;
  private frame?: number;

  connectedCallback() {
    super.connectedCallback();
    this.observe();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.unobserve();
  }

  protected willUpdate() {
    if ((this.form ?? this.closest("form")) !== this.observed) {
      this.observe();
    }
  }

  /** Recounts errors. Called automatically on form events. */
  refresh() {
    const form = this.observed;
    if (!form) {
      this.errorCount = 0;
      return;
    }
    let count = 0;
    for (const el of Array.from(form.elements)) {
      if (isBitControl(el)) {
        if (el.errors && (el.dirty || el.touched || el.showErrors)) {
          count += Object.keys(el.errors).length;
        }
      } else if (
        this.submitted &&
        "validity" in el &&
        (el as HTMLInputElement).willValidate &&
        !(el as HTMLInputElement).validity.valid
      ) {
        count += 1;
      }
    }
    this.errorCount = count;
  }

  private observe() {
    this.unobserve();
    this.observed = this.form ?? this.closest("form") ?? undefined;
    const form = this.observed;
    if (!form) {
      return;
    }
    FORM_EVENTS.forEach((type) => form.addEventListener(type, this.onFormEvent));
    // `invalid` doesn't bubble.
    form.addEventListener("invalid", this.onFormEvent, true);
    this.scheduleRefresh();
  }

  private unobserve() {
    const form = this.observed;
    if (form) {
      FORM_EVENTS.forEach((type) => form.removeEventListener(type, this.onFormEvent));
      form.removeEventListener("invalid", this.onFormEvent, true);
    }
    this.observed = undefined;
  }

  private onFormEvent = (event: Event) => {
    if (event.type === "submit" || event.type === "invalid") {
      this.submitted = true;
    } else if (event.type === "reset") {
      this.submitted = false;
    }
    this.scheduleRefresh();
  };

  // Controls update their touched/validity state asynchronously; count after they've rendered.
  private scheduleRefresh() {
    if (this.frame != null) {
      cancelAnimationFrame(this.frame);
    }
    this.frame = requestAnimationFrame(() => {
      this.frame = undefined;
      this.refresh();
    });
  }

  render() {
    return html`<div class="tw-text-danger tw-mt-2" aria-live="assertive">
      ${
        this.errorCount > 0
          ? html`<i class="bwi bwi-error" aria-hidden="true"></i> ${t(
                "fieldsNeedAttention",
                String(this.errorCount),
              )}`
          : nothing
      }
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-error-summary": BitErrorSummary;
  }
}
