import { Component } from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

import { IconButtonModule, BitIconButtonComponent } from "../icon-button";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-filter-menu-header",
  templateUrl: "filter-menu-header.component.html",
  imports: [IconButtonModule, BitIconButtonComponent, I18nPipe],
})
export class FilterMenuHeaderComponent {}
