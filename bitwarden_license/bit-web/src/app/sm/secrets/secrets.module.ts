import { NgModule } from "@angular/core";

import { SharedModule } from "src/app/modules/shared.module";

import { FilterComponent } from "../layout/filter.component";
import { HeaderComponent } from "../layout/header.component";
import { NewMenuComponent } from "../layout/new.menu.component";

import { SecretsListComponent } from "./secrets-list.component";
import { SecretsRoutingModule } from "./secrets-routing.module";
import { SecretsComponent } from "./secrets.component";

@NgModule({
  imports: [SharedModule, SecretsRoutingModule],
  declarations: [
    SecretsComponent,
    SecretsListComponent,
    HeaderComponent,
    FilterComponent,
    NewMenuComponent,
  ],
  providers: [],
})
export class SecretsModule {}
