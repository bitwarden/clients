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
 * A drawer is a panel of supplementary content that is adjacent to the page's main content.
 *
 * Drawers render in `bit-layout`. Drawers must be a descendant of `bit-layout`, but they do not need to be a direct descendant.
 */
@Component({
  selector: "bit-drawer",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, PortalModule],
  templateUrl: "drawer.component.html",
})
export class DrawerComponent {
  private drawerHost = inject(DrawerService);
  private readonly portal = viewChild.required(CdkPortal);

  /**
   * Whether or not the drawer is open.
   *
   * Note: Does not support implicit boolean transform due to Angular limitation. Must be bound explicitly `[open]="true"` instead of just `open`.
   * https://github.com/angular/angular/issues/55166#issuecomment-2032150999
   **/
  readonly open = model<boolean>(false);

  /**
   * The ARIA role of the drawer.
   *
   * - [complementary](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/complementary_role)
   *    - For drawers that contain content that is complementary to the page's main content. (default)
   * - [navigation](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/navigation_role)
   *    - For drawers that primary contain links to other content.
   */
  readonly role = input<"complementary" | "navigation">("complementary");

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
