import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { IntegrationType } from "@bitwarden/common/enums";

import { IntegrationsComponent } from "./integrations.component";
import {
  SmIntegrationsTabComponent,
  SmIntegrationsTabData,
} from "./sm-integrations-tab/sm-integrations-tab.component";

const integrationsTabData: SmIntegrationsTabData = {
  integrationType: IntegrationType.Integration,
  descriptionKey: "integrationsDesc",
  tooltipKey: "smIntegrationTooltip",
  ariaKey: "smIntegrationCardAriaLabel",
};

const sdksTabData: SmIntegrationsTabData = {
  integrationType: IntegrationType.SDK,
  descriptionKey: "sdksDesc",
  tooltipKey: "smSdkTooltip",
  ariaKey: "smSdkAriaLabel",
};

const routes: Routes = [
  {
    path: "",
    component: IntegrationsComponent,
    children: [
      { path: "", pathMatch: "full", redirectTo: "integrations" },
      { path: "integrations", component: SmIntegrationsTabComponent, data: integrationsTabData },
      { path: "sdks", component: SmIntegrationsTabComponent, data: sdksTabData },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class IntegrationsRoutingModule {}
