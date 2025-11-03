import { CdkTrapFocus } from "@angular/cdk/a11y";
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  viewChild,
  inject,
} from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

import { BitIconButtonComponent } from "../icon-button/icon-button.component";

import { NavDividerComponent } from "./nav-divider.component";
import { SideNavService } from "./side-nav.service";

export type SideNavVariant = "primary" | "secondary";

/**
 * Side navigation component that provides a collapsible navigation menu.
 */
@Component({
  selector: "bit-side-nav",
  templateUrl: "side-nav.component.html",
  imports: [CdkTrapFocus, NavDividerComponent, BitIconButtonComponent, I18nPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SideNavComponent {
  protected readonly sideNavService = inject(SideNavService);

  /**
   * Visual variant of the side navigation
   *
   * @default "primary"
   */
  readonly variant = input<SideNavVariant>("primary");

  private readonly toggleButton = viewChild("toggleButton", { read: ElementRef });

  protected readonly handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      this.sideNavService.setClose();
      this.toggleButton()?.nativeElement.focus();
      return false;
    }

    return true;
  };
}
