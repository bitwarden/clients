import { Portal } from "@angular/cdk/portal";
import { Directive, signal } from "@angular/core";

/**
 * Host that renders a drawer
 *
 * @internal
 */
@Directive({
  selector: "[bitDrawerHost]",
})
export class DrawerHostDirective {
  private _portal = signal<Portal<unknown> | undefined>(undefined);

  /** The portal to display */
  portal = this._portal.asReadonly();

  open(portal: Portal<unknown>) {
    this._portal.set(portal);
  }

  close(portal: Portal<unknown>) {
    if (portal === this.portal()) {
      this._portal.set(undefined);
    }
  }
}
