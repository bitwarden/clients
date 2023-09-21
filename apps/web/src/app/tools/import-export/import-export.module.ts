import { NgModule } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CollectionService } from "@bitwarden/common/vault/abstractions/collection.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import {
  ImportService,
  ImportServiceAbstraction,
  ImportApiService,
  ImportApiServiceAbstraction,
} from "@bitwarden/importer";

import { LooseComponentsModule, SharedModule } from "../../shared";

import {
  ImportErrorDialogComponent,
  ImportSuccessDialogComponent,
  FilePasswordPromptComponent,
} from "./dialog";
import { ExportComponent } from "./export.component";
import { ImportExportRoutingModule } from "./import-export-routing.module";
import { ImportComponent } from "./import.component";

@NgModule({
  imports: [SharedModule, LooseComponentsModule, ImportExportRoutingModule],
  declarations: [
    ImportComponent,
    ExportComponent,
    FilePasswordPromptComponent,
    ImportErrorDialogComponent,
    ImportSuccessDialogComponent,
  ],
  providers: [
    {
      provide: ImportApiServiceAbstraction,
      useClass: ImportApiService,
      deps: [ApiService],
    },
    {
      provide: ImportServiceAbstraction,
      useClass: ImportService,
      deps: [
        CipherService,
        FolderService,
        ImportApiServiceAbstraction,
        I18nService,
        CollectionService,
        CryptoService,
      ],
    },
  ],
})
export class ImportExportModule {}
