import { LitElement, PropertyValues } from "lit";
import { customElement, property } from "lit/decorators.js";

import type { BitwardenIcon } from "../icon/shared-icon";

/** @internal Fired when a data holder's properties change, so the bar re-renders. */
export const BULK_ACTION_CHANGE_EVENT = "bit-bulk-action-change";

/** Shared base for `bit-bulk-action` and `bit-bulk-additional-action`. */
abstract class BulkActionDataElement extends LitElement {
  /** Called when the user activates the action. A `click` event also fires on this element. */
  @property({ attribute: false }) action?: () => void;

  @property() label = "";

  @property({ type: Boolean }) disabled = false;

  abstract icon?: BitwardenIcon;

  connectedCallback() {
    super.connectedCallback();
    this.style.display = "none";
  }

  protected createRenderRoot() {
    return this;
  }

  /** @internal Runs the action from the bar's rendered button or menu item. */
  run() {
    if (this.disabled) {
      return;
    }
    this.action?.();
    this.click();
  }

  protected updated(changed: PropertyValues) {
    if (changed.has("label") || changed.has("icon") || changed.has("disabled")) {
      this.dispatchEvent(new Event(BULK_ACTION_CHANGE_EVENT, { bubbles: true, composed: true }));
    }
  }
}

/**
 * Declares a primary action in a `bit-bulk-actions-bar`. Renders nothing itself; the bar renders
 * the toolbar button (and the menu item, when it packs into the overflow menu).
 *
 * `icon` is required because every action in the toolbar row needs one, both for the labeled row
 * and for the compact icon-only mode it collapses into.
 */
@customElement("bit-bulk-action")
export class BitBulkAction extends BulkActionDataElement {
  @property() icon!: BitwardenIcon;
}

/**
 * Declares an action that lives only in the bar's "Additional actions" menu, never in the
 * toolbar row. Renders nothing itself.
 *
 * `icon` is optional here: menu items can be label-only.
 */
@customElement("bit-bulk-additional-action")
export class BitBulkAdditionalAction extends BulkActionDataElement {
  @property() icon?: BitwardenIcon;
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-bulk-action": BitBulkAction;
    "bit-bulk-additional-action": BitBulkAdditionalAction;
  }
}
