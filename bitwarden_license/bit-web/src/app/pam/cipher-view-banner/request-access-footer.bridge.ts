import { Injectable, Signal, signal } from "@angular/core";

/**
 * The request-access flow as the vault item dialog's footer needs to see it: the card
 * (`CIPHER_VIEW_BANNER`) owns the form, the footer (`CIPHER_VIEW_FOOTER_ACTIONS`) owns the
 * buttons that drive it. An interface rather than the component class, so neither seam imports
 * the other's component. Each side focuses only the DOM it owns — the card its fold-out, the
 * footer its own toggle.
 */
export interface RequestAccessFooterActions {
  /** Rendered only against a matching cipher, so a handle left from a previous item is inert. */
  readonly cipherId: string;

  /** Gated, licensed, and nothing already in play. */
  readonly visible: Signal<boolean>;

  readonly expanded: Signal<boolean>;

  /** False while the pre-check runs, and when it returns no terms — Cancel then stands alone. */
  readonly submittable: Signal<boolean>;

  readonly toggle: () => Promise<void>;

  /** Bound through `[bitAction]`, so the footer's button owns the spinner. */
  readonly submit: () => Promise<void>;
}

/**
 * Root-provided and single-valued: the item dialog is a singleton surface, so at most one gated
 * cipher is open. {@link withdraw} is identity-checked, so a card torn down after its replacement
 * has published cannot blank out the live handle.
 */
@Injectable({ providedIn: "root" })
export class RequestAccessFooterBridge {
  private readonly published = signal<RequestAccessFooterActions | null>(null);

  readonly actions: Signal<RequestAccessFooterActions | null> = this.published.asReadonly();

  publish(actions: RequestAccessFooterActions): void {
    this.published.set(actions);
  }

  withdraw(actions: RequestAccessFooterActions): void {
    if (this.published() === actions) {
      this.published.set(null);
    }
  }
}
