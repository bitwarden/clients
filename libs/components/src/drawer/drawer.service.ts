import { Portal } from "@angular/cdk/portal";
import { Injectable, signal } from "@angular/core";

/**
 * Controls the visibility of drawers. Consumed by the drawer itself and its container (`bit-layout`).
 *
 * @internal
 */
@Injectable({
  providedIn: "root",
})
export class DrawerService {
  /** The portal to display */
  portal = signal<Portal<unknown> | undefined>(undefined);

  open(portal: Portal<unknown>) {
    this.portal.set(portal);
  }

  close(portal: Portal<unknown>) {
    if (this.portal() === portal) {
      this.portal.set(undefined);
    }
  }
}
