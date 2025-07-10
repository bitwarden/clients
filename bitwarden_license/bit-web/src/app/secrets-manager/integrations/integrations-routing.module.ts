import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { IntegrationsComponent } from "./integrations.component";

const routes: Routes = [
  {
    path: "",
    component: IntegrationsComponent,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class IntegrationsRoutingModule {}
