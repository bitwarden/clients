import { A11yModule } from "@angular/cdk/a11y";
import { Component, EventEmitter, Output, TemplateRef, input, viewChild } from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

import { IconButtonModule } from "../icon-button/icon-button.module";
import { TypographyModule } from "../typography";

/**
 * Popover component for displaying contextual content in an overlay.
 * Used with `bitPopoverAnchor` or `bitPopoverTriggerFor` directives.
 */
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-popover",
  imports: [A11yModule, I18nPipe, IconButtonModule, TypographyModule],
  templateUrl: "./popover.component.html",
  exportAs: "popoverComponent",
})
export class PopoverComponent {
  /** Reference to the popover content template */
  readonly templateRef = viewChild.required(TemplateRef);

  /** Optional title displayed in the popover header */
  readonly title = input("");

  /** Event emitted when the popover should close */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() closed = new EventEmitter();
}
