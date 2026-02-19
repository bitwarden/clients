import { Portal } from "@angular/cdk/portal";
import { Injectable, signal } from "@angular/core";

@Injectable({ providedIn: "root" })
export class DrawerService {
  private readonly _portal = signal<Portal<unknown> | undefined>(undefined);
  private readonly _pushWidthPx = signal(0);

  /** The portal to display */
  portal = this._portal.asReadonly();

  /**
   * The drawer's preferred push-mode column width in px.
   * Declared by the drawer content (e.g. bit-dialog) via declarePushWidth().
   * Zero when no drawer is active or the width has not been declared yet.
   */
  readonly pushWidthPx = this._pushWidthPx.asReadonly();

  /**
   * Whether the drawer is currently in push mode (occupying its own grid column).
   * Set by LayoutComponent via ResizeObserver; read by the drawer content for display.
   */
  readonly isPushMode = signal(false);

  open(portal: Portal<unknown>) {
    this._portal.set(portal);
  }

  close(portal: Portal<unknown>) {
    if (portal === this.portal()) {
      this._portal.set(undefined);
      this._pushWidthPx.set(0);
      this.isPushMode.set(false);
    }
  }

  /**
   * Called by drawer content components (e.g. bit-dialog) to declare their natural
   * push-mode column width so LayoutComponent can make accurate push/overlay decisions
   * without measuring the DOM (which is unreliable when the column is 1fr).
   */
  declarePushWidth(px: number) {
    this._pushWidthPx.set(px);
  }
}
