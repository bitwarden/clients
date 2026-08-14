import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";

import {
  AsyncActionsModule,
  ButtonModule,
  DialogModule,
  DialogRef,
  DialogService,
} from "@bitwarden/components";
import {
  DefaultImportMetadataService,
  ImportMetadataServiceAbstraction,
} from "@bitwarden/importer-core";
import {
  ImportComponent,
  ImporterProviders,
  SYSTEM_SERVICE_PROVIDER,
} from "@bitwarden/importer-ui";
import { I18nPipe, safeProvider } from "@bitwarden/ui-common";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "import-dialog.component.html",
  imports: [
    CommonModule,
    I18nPipe,
    DialogModule,
    AsyncActionsModule,
    ButtonModule,
    ImportComponent,
  ],
  providers: [
    ...ImporterProviders,
    safeProvider({
      provide: ImportMetadataServiceAbstraction,
      useClass: DefaultImportMetadataService,
      deps: [SYSTEM_SERVICE_PROVIDER],
    }),
  ],
})
export class ImportDialogComponent {
  protected loading = false;
  protected disabled = false;

  constructor(public dialogRef: DialogRef) {}

  protected async onSuccessfulImport(_organizationId: string): Promise<void> {
    await this.dialogRef.close();
  }

  static open(dialogService: DialogService): DialogRef {
    return dialogService.open(ImportDialogComponent);
  }
}
