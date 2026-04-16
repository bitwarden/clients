import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";

import { DialogRef, AsyncActionsModule, ButtonModule, DialogModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { ExportComponent } from "@bitwarden/vault-export-ui";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "export-desktop.component.html",
  imports: [
    CommonModule,
    I18nPipe,
    DialogModule,
    AsyncActionsModule,
    ButtonModule,
    ExportComponent,
  ],
})
export class ExportDesktopComponent {
  protected disabled = false;
  protected loading = false;

  constructor(public dialogRef: DialogRef) {}

  /**
   * Callback that is called after a successful export.
   */
  protected async onSuccessfulExport(organizationId: string): Promise<void> {
    this.dialogRef.close();
  }
}
