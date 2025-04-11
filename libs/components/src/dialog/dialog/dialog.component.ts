// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CdkTrapFocus } from "@angular/cdk/a11y";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { CommonModule } from "@angular/common";
import { Component, HostBinding, Input, inject } from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

import { BitIconButtonComponent } from "../../icon-button/icon-button.component";
import { TypographyDirective } from "../../typography/typography.directive";
import { fadeIn } from "../animations";
import { DialogRef, IS_DRAWER_TOKEN } from "../dialog.service";
import { DialogCloseDirective } from "../directives/dialog-close.directive";
import { DialogTitleContainerDirective } from "../directives/dialog-title-container.directive";

@Component({
  selector: "bit-dialog",
  templateUrl: "./dialog.component.html",
  animations: [fadeIn],
  standalone: true,
  host: {
    "(keydown.esc)": "handleEsc()",
  },
  imports: [
    CommonModule,
    DialogTitleContainerDirective,
    TypographyDirective,
    BitIconButtonComponent,
    DialogCloseDirective,
    I18nPipe,
    CdkTrapFocus,
  ],
})
export class DialogComponent {
  private dialogRef = inject(DialogRef, { optional: true });
  protected isDrawer = inject(IS_DRAWER_TOKEN, { optional: true }) ?? false;

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
    return ["tw-flex", "tw-flex-col"]
      .concat(
        this.width,
        !this.isDrawer ? ["tw-p-4", "tw-w-screen", "tw-max-h-[90vh]"] : ["tw-min-h-screen"],
      )
      .flat();
  }

  handleEsc() {
    this.dialogRef.close();
  }

  get width() {
    switch (this.dialogSize) {
      case "small": {
        return "md:tw-max-w-sm";
      }
      case "large": {
        return "md:tw-max-w-3xl";
      }
      default: {
        return "md:tw-max-w-xl";
      }
    }
  }
}
