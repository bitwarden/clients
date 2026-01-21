import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ButtonModule, DialogModule, DialogRef, TypographyModule } from "@bitwarden/components";

@Component({
  templateUrl: "./autofill-suggestions-info-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DialogModule, TypographyModule, ButtonModule, JslibModule],
})
export class AutofillSuggestionsInfoDialogComponent {
  private dialogRef = inject(DialogRef<void>);

  close() {
    this.dialogRef.close();
  }
}
