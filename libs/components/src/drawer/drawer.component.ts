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

import { DrawerService } from "./drawer.service";

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
  private drawerService = inject(DrawerService);
  private portal = viewChild(CdkPortal);

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
    /**
     * When a drawer opens, attach it and close all other drawers
     */
    effect(
      () => {
        const portal = this.portal();
        if (!portal) {
          return;
        }

        if (this.open()) {
          this.drawerService.open(portal);
        } else {
          this.drawerService.close(portal);
        }
      },
      {
        allowSignalWrites: true,
      },
    );

    effect(
      () => {
        this.open.set(this.drawerService.portal() === this.portal());
      },
      {
        allowSignalWrites: true,
      },
    );
  }

  toggle() {
    this.open.update((prev) => !prev);
  }
}
