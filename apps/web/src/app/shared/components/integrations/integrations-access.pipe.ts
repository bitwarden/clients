import { Pipe, PipeTransform } from "@angular/core";

import { PlanType } from "@bitwarden/common/billing/enums";
import { IntegrationType } from "@bitwarden/common/enums";

import { IntegrationAccess } from "./models";

@Pipe({
  name: "integrationAccess",
  standalone: true,
})
export class IntegrationsAccessPipe implements PipeTransform {
  transform(
    integrationType: IntegrationType,
    type: PlanType,
    accessList: IntegrationAccess[],
  ): boolean {
    const integrationAccess = accessList.find(
      (integrationAccess) => integrationAccess.type === integrationType,
    );
    return integrationAccess.canAccess.includes(type);
  }
}
