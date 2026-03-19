import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";

import { SideNavVariant, NavigationModule } from "@bitwarden/components";

import { ProductSwitcherModule } from "./product-switcher/product-switcher.module";
import { ToggleWidthComponent } from "./toggle-width.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-side-nav",
  templateUrl: "web-side-nav.component.html",
  imports: [CommonModule, NavigationModule, ProductSwitcherModule, ToggleWidthComponent],
})
export class WebSideNavComponent {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() variant: SideNavVariant = "primary";
}
