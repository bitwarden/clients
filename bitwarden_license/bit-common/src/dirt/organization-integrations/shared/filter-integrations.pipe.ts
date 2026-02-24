import { Pipe, PipeTransform } from "@angular/core";

import { IntegrationType } from "@bitwarden/common/enums";

import { Integration } from "../models/integration";

@Pipe({
  name: "filterIntegrations",
  standalone: true,
})
export class FilterIntegrationsPipe implements PipeTransform {
  transform(integrations: Integration[] | null | undefined, type: IntegrationType): Integration[] {
    if (!integrations) {
      return [];
    }
    return integrations.filter((integration) => integration.type === type);
  }
}
