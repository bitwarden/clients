import { CdkPortal, PortalModule } from "@angular/cdk/portal";
import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  model,
  viewChild,
} from "@angular/core";

import { DrawerHostDirective } from "./drawer-host.directive";

/**
 * A drawer is a panel of supplmentary content that is adjacement to the page's main content.
 *
 * Drawers render in `bit-layout`.
 */
@Component({
  selector: "bit-drawer",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, PortalModule],
  templateUrl: "drawer.component.html",
})
export class DrawerComponent {
  private drawerHost = inject(DrawerHostDirective);
  private portal = viewChild.required(CdkPortal);

  /**
   * Whether or not the drawer is open.
   *
   * Note: Does not support implicit boolean transform due to Angular limitation. Must be bound explicitly `[open]="true"` instead of just `open`.
   **/
  open = model<boolean>(false);

  /**
   * The ARIA role of the drawer.
   *
   * - [complimentary](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/complementary_role)
   *    - For drawers that contain content that is complimentary to the page's main content. (default)
   * - [navigation](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/navigation_role)
   *    - For drawers that primary contain links to other content.
   */
  role = input<"complimentary" | "navigation">("complimentary");

  constructor() {
    effect(
      () => {
        this.open() ? this.drawerHost.open(this.portal()) : this.drawerHost.close(this.portal());
      },
      {
        allowSignalWrites: true,
      },
    );

    // Set `open` to `false` when another drawer is opened.
    effect(
      () => {
        if (this.drawerHost.portal() !== this.portal()) {
          this.open.set(false);
        }
      },
      {
        allowSignalWrites: true,
      },
    );
  }

  /** Toggle the drawer between open & closed */
  toggle() {
    this.open.update((prev) => !prev);
  }
}
