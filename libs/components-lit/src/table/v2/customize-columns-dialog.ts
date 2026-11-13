import { html } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { live } from "lit/directives/live.js";

import { BitElement } from "../../core/bit-element";
import { t } from "../../core/i18n";
import "../../button/button";
import "../../dialog/dialog";
import { dialogClose } from "../../dialog/dialog-close";
import { openDialog } from "../../dialog/dialog-service";
import "../../form-control/form-control-group";
import "../../switch/switch";

/** Data passed to `bit-customize-columns-dialog`. */
export interface CustomizeColumnsDialogParams {
  /** The togglable columns, in display order. */
  readonly columns: readonly { name: string; label: string }[];
  /** The names hidden when the dialog opens. */
  readonly hidden: ReadonlySet<string>;
  /** Shows or hides one column. Idempotent. */
  readonly setHidden: (name: string, hidden: boolean) => void;
  /** Restores the declared column set. */
  readonly reset: () => void;
}

/**
 * Picks which of a `bit-table-v2`'s columns are shown. Opened by the toolbar's Customize button.
 *
 * Switches apply immediately, so there's no submit or cancel; Done and X just dismiss.
 *
 * @internal
 */
@customElement("bit-customize-columns-dialog")
export class BitCustomizeColumnsDialog extends BitElement {
  /** Set by `openDialog`. */
  @property({ attribute: false }) data?: CustomizeColumnsDialogParams;

  @state() private hiddenNames = new Set<string>();

  @query("[data-done]") private doneButton?: HTMLElement;

  // Light DOM, so `bit-dialog` is a direct descendant of the dialog container like any other
  // dialog content.
  protected createRenderRoot(): HTMLElement {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    this.hiddenNames = new Set(this.data?.hidden ?? []);
  }

  private toggle(name: string, shown: boolean) {
    this.data?.setHidden(name, !shown);
    const next = new Set(this.hiddenNames);
    if (shown) {
      next.delete(name);
    } else {
      next.add(name);
    }
    this.hiddenNames = next;
  }

  private async resetToDefault() {
    this.data?.reset();
    this.hiddenNames = new Set();
    // Resetting removes this very button, so hand focus to Done rather than letting it fall to
    // the body.
    await this.updateComplete;
    this.doneButton?.focus();
  }

  protected render() {
    const modified = this.hiddenNames.size > 0;
    return html`<bit-dialog heading=${t("customizeYourView")} dialog-size="default">
      <bit-form-control-group label=${t("showColumns")}>
        ${(this.data?.columns ?? []).map(
          (col) =>
            html`<bit-switch
              card
              label=${col.label}
              .checked=${live(!this.hiddenNames.has(col.name))}
              @change=${(e: Event) => this.toggle(col.name, (e.target as HTMLInputElement).checked)}
            ></bit-switch>`,
        )}
      </bit-form-control-group>
      <bit-button slot="footer" button-type="primary" data-done ${dialogClose()}>
        ${t("done")}
      </bit-button>
      ${
        modified
          ? html`<bit-button
              slot="footer"
              button-type="secondary"
              start-icon="bwi-refresh"
              @click=${() => this.resetToDefault()}
            >
              ${t("resetToDefault")}
            </bit-button>`
          : null
      }
    </bit-dialog>`;
  }
}

/** Opens the Customize columns dialog. */
export function openCustomizeColumnsDialog(params: CustomizeColumnsDialogParams) {
  return openDialog<unknown, CustomizeColumnsDialogParams>("bit-customize-columns-dialog", {
    data: params,
  });
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-customize-columns-dialog": BitCustomizeColumnsDialog;
  }
}
