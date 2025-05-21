// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { CommonModule } from "@angular/common";
import { Component, HostBinding, Input } from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

import { BitIconButtonComponent } from "../../icon-button/icon-button.component";
import { TypographyDirective } from "../../typography/typography.directive";
import { fadeIn } from "../animations";
import { DialogCloseDirective } from "../directives/dialog-close.directive";
import { DialogTitleContainerDirective } from "../directives/dialog-title-container.directive";

@Component({
  selector: "bit-dialog",
  templateUrl: "./dialog.component.html",
  animations: [fadeIn],
  standalone: true,
  imports: [
    CommonModule,
    DialogTitleContainerDirective,
    TypographyDirective,
    BitIconButtonComponent,
    DialogCloseDirective,
    I18nPipe,
  ],
})
export class DialogComponent {
  /** Background color */
  @Input()
  background: "default" | "alt" = "default";

  /**
   * Dialog size, more complex dialogs should use large, otherwise default is fine.
   */
  @Input() dialogSize: "small" | "default" | "large" = "default";

  /**
   * Title to show in the dialog's header
   */
  @Input() title: string;

  /**
   * Subtitle to show in the dialog's header
   */
  @Input() subtitle: string;

  private _disablePadding = false;
  /**
   * Disable the built-in padding on the dialog, for use with tabbed dialogs.
   */
  @Input() set disablePadding(value: boolean | "") {
    this._disablePadding = coerceBooleanProperty(value);
  }
  get disablePadding() {
    return this._disablePadding;
  }

  /**
   * Mark the dialog as loading which replaces the content with a spinner.
   */
  @Input() loading = false;

  @HostBinding("class") get classes() {
    // `tw-max-h-[90vh]` is needed to prevent dialogs from overlapping the desktop header
    return ["tw-flex", "tw-flex-col", "tw-w-screen", "tw-p-4", "tw-max-h-[90vh]"].concat(
      this.width,
    );
  }

  get width() {
    switch (this.dialogSize) {
      case "small": {
        return "tw-max-w-sm";
      }
      case "large": {
        return "tw-max-w-3xl";
      }
      default: {
        return "tw-max-w-xl";
      }
    }
  }
}
