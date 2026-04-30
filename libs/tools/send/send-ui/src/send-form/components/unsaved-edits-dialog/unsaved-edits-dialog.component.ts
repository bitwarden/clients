import { ChangeDetectionStrategy, Component } from "@angular/core";

import { ButtonModule, DialogModule, DialogRef } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/** A result of the unsaved edits dialog. */
export const UnsavedEditsDialogResult = Object.freeze({
  /** Discard unsaved edits */
  Discard: "discard",
  /** Go back to editing */
  Back: "back",
} as const);

/** A result of the unsaved edits dialog. */
export type UnsavedEditsDialogResult = {
  result: (typeof UnsavedEditsDialogResult)[keyof typeof UnsavedEditsDialogResult];
};

@Component({
  selector: "tools-unsaved-edits-dialog",
  templateUrl: "./unsaved-edits-dialog.component.html",
  providers: [],
  imports: [I18nPipe, DialogModule, ButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UnsavedEditsDialogComponent {
  constructor(private readonly dialogRef: DialogRef<UnsavedEditsDialogResult>) {}

  discardEdits() {
    void this.dialogRef.close({ result: UnsavedEditsDialogResult.Discard });
  }

  backToEditing() {
    void this.dialogRef.close({ result: UnsavedEditsDialogResult.Back });
  }
}
