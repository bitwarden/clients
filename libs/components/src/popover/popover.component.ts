import { A11yModule } from "@angular/cdk/a11y";
import { Component, EventEmitter, Output, TemplateRef, input, viewChild } from "@angular/core";

import { IconButtonModule } from "../icon-button/icon-button.module";
import { SharedModule } from "../shared/shared.module";
import { TypographyModule } from "../typography";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-popover",
  imports: [A11yModule, IconButtonModule, SharedModule, TypographyModule],
  templateUrl: "./popover.component.html",
  exportAs: "popoverComponent",
})
export class PopoverComponent {
  readonly templateRef = viewChild.required(TemplateRef);
  readonly title = input("");
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() closed = new EventEmitter();
}
