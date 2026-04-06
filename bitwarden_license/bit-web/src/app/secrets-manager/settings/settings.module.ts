import { NgModule } from "@angular/core";

import { SecretsManagerSharedModule } from "../shared/sm-shared.module";

import { SecretsManagerImportErrorDialogComponent } from "./dialog/sm-import-error-dialog.component";
import { SecretsManagerExportComponent } from "./porting/sm-export.component";
import { SecretsManagerImportComponent } from "./porting/sm-import.component";
import { SecretsManagerPortingService } from "./services/sm-porting.service";
import { SettingsRoutingModule } from "./settings-routing.module";

@NgModule({
  imports: [SecretsManagerSharedModule, SettingsRoutingModule],
  declarations: [
    SecretsManagerImportComponent,
    SecretsManagerExportComponent,
    SecretsManagerImportErrorDialogComponent,
  ],
  providers: [SecretsManagerPortingService],
})
export class SettingsModule {}
