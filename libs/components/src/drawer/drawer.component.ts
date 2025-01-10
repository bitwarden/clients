import { CdkPortal, PortalModule } from "@angular/cdk/portal";
import { CommonModule } from "@angular/common";
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
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
   * Controls the visibility of the drawer
   *
   * Note: Does not support implicit boolean transform due to Angular limitation. Must be bound explicitly `[open]="true"` instead of just `open`.
   **/
  open = model<boolean>(false);

  constructor() {
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
