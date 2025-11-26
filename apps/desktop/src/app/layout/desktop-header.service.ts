import { Portal } from "@angular/cdk/portal";
import { Injectable, signal } from "@angular/core";

@Injectable({ providedIn: "root" })
export class DesktopHeaderService {
  private readonly _portal = signal<Portal<unknown> | undefined>(undefined);
  private readonly _isAttached = signal(false);

  /** The portal to display in the desktop header slot */
  portal = this._portal.asReadonly();

  /** Whether the header is currently attached to a portal outlet */
  isAttached = this._isAttached.asReadonly();

  setHeader(portal: Portal<unknown>) {
    this._portal.set(portal);
  }

  clearHeader() {
    this._portal.set(undefined);
  }

  setAttached(attached: boolean) {
    this._isAttached.set(attached);
  }
}
