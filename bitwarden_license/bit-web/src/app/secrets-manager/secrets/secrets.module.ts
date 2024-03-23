import { NgModule } from "@angular/core";

import { SecretsManagerSharedModule } from "../shared/sm-shared.module";

import { SecretDeleteDialogComponent } from "./dialog/secret-delete.component";
import { SecretDialogComponent } from "./dialog/secret-dialog.component";
import { SecretMoveProjectComponent } from "./dialog/secret-move-project.component";
import { SecretsRoutingModule } from "./secrets-routing.module";
import { SecretsComponent } from "./secrets.component";

@NgModule({
  imports: [SecretsManagerSharedModule, SecretsRoutingModule],
  declarations: [
    SecretDeleteDialogComponent,
    SecretDialogComponent,
    SecretsComponent,
    SecretMoveProjectComponent,
  ],
  providers: [],
})
export class SecretsModule {}
