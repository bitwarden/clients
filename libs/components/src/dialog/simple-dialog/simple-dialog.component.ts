import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { Component, ContentChild, Directive, input } from "@angular/core";

import { TypographyDirective } from "../../typography/typography.directive";
import { fadeIn } from "../animations";
import { DialogTitleContainerDirective } from "../directives/dialog-title-container.directive";

@Directive({
  selector: "[bitDialogIcon]",
  standalone: true,
})
export class IconDirective {}

@Component({
  selector: "bit-simple-dialog",
  templateUrl: "./simple-dialog.component.html",
  animations: [fadeIn],
  standalone: true,
  imports: [DialogTitleContainerDirective, TypographyDirective],
})
export class SimpleDialogComponent {
  @ContentChild(IconDirective) icon!: IconDirective;

  /**
   * Optional flag to hide the dialog's center icon. Defaults to false.
   */
  hideIcon = input(false, { transform: coerceBooleanProperty });

  get hasIcon() {
    return this.icon != null;
  }
}
