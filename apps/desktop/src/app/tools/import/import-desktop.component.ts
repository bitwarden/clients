import { DialogRef } from "@angular/cdk/dialog";
import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AsyncActionsModule, ButtonModule, DialogModule } from "@bitwarden/components";
import { ImportComponent } from "@bitwarden/importer-ui";

@Component({
  templateUrl: "import-desktop.component.html",
  standalone: true,
  imports: [
    CommonModule,
    JslibModule,
    DialogModule,
    AsyncActionsModule,
    ButtonModule,
    ImportComponent,
  ],
})
export class ImportDesktopComponent {
  protected disabled = false;
  protected loading = false;

  constructor(public dialogRef: DialogRef) {}

  /**
   * Callback that is called after a successful import.
   */
  protected async onSuccessfulImport(organizationId: string): Promise<void> {
    this.dialogRef.close();
  }
}
