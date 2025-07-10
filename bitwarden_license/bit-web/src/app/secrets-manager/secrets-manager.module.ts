import { NgModule } from "@angular/core";

import { SharedModule } from "@bitwarden/web-vault/app/shared";

import { LayoutModule } from "./layout/layout.module";
import { SecretsManagerSharedModule } from "./shared/sm-shared.module";
import { SecretsManagerRoutingModule } from "./sm-routing.module";

@NgModule({
  imports: [SharedModule, SecretsManagerSharedModule, SecretsManagerRoutingModule, LayoutModule],
})
export class SecretsManagerModule {}
