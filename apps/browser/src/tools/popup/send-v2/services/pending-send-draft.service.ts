import { Injectable } from "@angular/core";

import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";

/**
 * In-memory single-shot stash for a Send draft built from a vault item.
 *
 * The browser extension's Send composer is reached via routed navigation, so the only ways to hand
 * it a pre-filled `SendView` are URL query params (which would expose the credential plaintext) or
 * an in-memory hand-off. This service holds the prepared view between the click on
 * "Share via Send" in the vault item menu and the composer's `ngOnInit`.
 *
 * A caller-generated token is stored alongside the view and passed through the route as a query
 * param. The composer must present the same token to consume the draft. This prevents an unrelated
 * navigation to the composer (for example, the regular "New Send" button) from silently inheriting
 * a stale credential if the original share-via-send navigation was cancelled or never completed.
 */
@Injectable({ providedIn: "root" })
export class PendingSendDraftService {
  private draft: { token: string; view: SendView } | null = null;

  set(token: string, view: SendView): void {
    this.draft = { token, view };
  }

  /**
   * Returns the stashed draft when the supplied token matches the one stored at `set` time, then
   * clears the stash. A token mismatch (or no stash) returns `null` and clears any held draft, so
   * a stale credential can never silently surface in a later flow.
   */
  consume(expectedToken: string): SendView | null {
    const held = this.draft;
    this.draft = null;
    if (held == null || held.token !== expectedToken) {
      return null;
    }
    return held.view;
  }

  clear(): void {
    this.draft = null;
  }
}
