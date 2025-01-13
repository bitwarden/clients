import { Portal } from "@angular/cdk/portal";
import { Directive, signal } from "@angular/core";

/**
 * Host that renders a drawer
 *
 * @internal
 */
@Directive({
  selector: "[bitDrawerHost]",
  standalone: true,
})
export class DrawerHostDirective {
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
