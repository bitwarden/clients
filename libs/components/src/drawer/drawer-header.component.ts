import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, HostBinding, input } from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

import { IconButtonModule } from "../icon-button";
import { TypographyModule } from "../typography";

import { DrawerCloseDirective } from "./drawer-close.directive";

/**
 * Header container for `bit-drawer`
 **/
@Component({
  selector: "bit-drawer-header",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DrawerCloseDirective, TypographyModule, IconButtonModule, I18nPipe],
  templateUrl: "drawer-header.component.html",
  host: {
    class: "tw-block tw-pl-4 tw-pr-2 tw-py-2",
  },
})
export class DrawerHeaderComponent {
  /**
   * The title to display
   */
  title = input.required<string>();

  /** We don't want to set the HTML title attribute with `this.title` */
  @HostBinding("attr.title")
  protected get getTitle(): null {
    return null;
  }
}
