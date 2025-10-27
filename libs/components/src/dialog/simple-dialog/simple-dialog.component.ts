import { booleanAttribute, Component, ContentChild, Directive, input } from "@angular/core";

import { TypographyDirective } from "../../typography/typography.directive";
import { fadeIn } from "../animations";
import { DialogTitleContainerDirective } from "../directives/dialog-title-container.directive";

@Directive({
  selector: "[bitDialogIcon]",
})
export class IconDirective {}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-simple-dialog",
  templateUrl: "./simple-dialog.component.html",
  animations: [fadeIn],
  imports: [DialogTitleContainerDirective, TypographyDirective],
})
export class SimpleDialogComponent {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ContentChild(IconDirective) icon!: IconDirective;

  /**
   * Optional flag to hide the dialog's center icon. Defaults to false.
   */
  readonly hideIcon = input(false, { transform: booleanAttribute });

  get hasIcon() {
    return this.icon != null;
  }
}
