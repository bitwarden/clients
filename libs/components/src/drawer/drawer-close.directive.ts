import { Directive, inject } from "@angular/core";

import { DrawerComponent } from "./drawer.component";

/**
 * Closes the ancestor drawer
 *
 * @example
 *
 * ```html
 * <bit-drawer>
 *  <button type="button" bitButton bitDrawerClose>Close</button>
 * </bit-drawer>
 * ```
 **/
@Directive({
  selector: "button[bitDrawerClose]",
  standalone: true,
  host: {
    "(click)": "onClick()",
  },
})
export class DrawerCloseDirective {
  private drawer = inject(DrawerComponent, { optional: true });

  protected onClick() {
    this.drawer?.open.set(false);
  }
}
