import { Injectable, Signal, signal } from "@angular/core";

/**
 * The request-access flow as the vault item dialog's FOOTER needs to see it.
 *
 * PM-43662 moved the request affordance out of the in-body card and into the dialog footer, to
 * follow the standard footer pattern for primary and secondary actions. That splits one flow
 * across two components mounted in different seams — the card
 * ({@link CipherViewBannerComponent}, `CIPHER_VIEW_BANNER`) still owns the form, while the
 * buttons that drive it live in the footer (`CIPHER_VIEW_FOOTER_ACTIONS`) — so the two need a
 * shared handle.
 *
 * Deliberately NOT the component class: the footer depends on this interface alone, so neither
 * seam imports the other's component and the card stays free to change how it renders the form.
 *
 * Each side keeps the DOM it owns. The card focuses its fold-out when the form opens; the footer
 * refocuses its own toggle when the form collapses. Do not route focus across the bridge — a
 * component reaching for another's element is what the two seams exist to avoid.
 */
export interface RequestAccessFooterActions {
  /**
   * The cipher whose flow this is. The footer renders a published handle only when it matches
   * the cipher the dialog handed it, so a handle left over from a previous item is inert rather
   * than driving the wrong request.
   */
  readonly cipherId: string;

  /** True while the request-access state is the one showing — gated, licensed, nothing in play. */
  readonly visible: Signal<boolean>;

  /** True once the form is open, which swaps the footer from [Request access] to [Submit request]/[Cancel]. */
  readonly expanded: Signal<boolean>;

  /**
   * True when a form is actually mounted to submit. False while the pre-check is still running,
   * and when it came back without terms to fill in — the fold-out then offers Cancel alone.
   */
  readonly submittable: Signal<boolean>;

  /** Opens the form, or collapses it again. */
  readonly toggle: () => Promise<void>;

  /** Submits the open form. Bound through `[bitAction]`, so the footer button owns the spinner. */
  readonly submit: () => Promise<void>;
}

/**
 * Carries the open cipher's {@link RequestAccessFooterActions} from the in-body card to the
 * dialog footer.
 *
 * Root-provided and single-valued: the vault item dialog is a singleton surface, so at most one
 * gated cipher is ever open. The card publishes on init and withdraws on destroy, and
 * {@link withdraw} is identity-checked so a card being torn down after its replacement has
 * already published cannot blank out the live handle.
 */
@Injectable({ providedIn: "root" })
export class RequestAccessFooterBridge {
  private readonly published = signal<RequestAccessFooterActions | null>(null);

  /** The handle for the cipher currently open, or null when nothing has published one. */
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
