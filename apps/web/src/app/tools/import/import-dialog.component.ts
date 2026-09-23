import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";

import {
  AsyncActionsModule,
  ButtonModule,
  DIALOG_DATA,
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

interface ImportDialogData {
  /** Pre-selects an organization in the import form */
  defaultOrganizationId?: string;
  /** Pre-selects a collection in the import form; only applied when defaultOrganizationId is also set */
  defaultCollectionId?: string;
}

@Component({
  templateUrl: "import-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
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
  protected readonly loading = signal(false);
  protected readonly disabled = signal(false);
  protected readonly data = inject<ImportDialogData>(DIALOG_DATA, { optional: true });

  constructor(readonly dialogRef: DialogRef) {}

  protected async onSuccessfulImport(_organizationId: string): Promise<void> {
    await this.dialogRef.close();
  }

  static open(
    dialogService: DialogService,
    defaultOrganizationId?: string,
    defaultCollectionId?: string,
  ): DialogRef {
    return dialogService.open(ImportDialogComponent, {
      data: { defaultOrganizationId, defaultCollectionId },
    });
  }
}
