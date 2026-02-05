import { Pipe, PipeTransform } from "@angular/core";

import { Integration } from "@bitwarden/bit-common/dirt/organization-integrations/models/integration";
import { IntegrationType } from "@bitwarden/common/enums";

@Pipe({
  name: "filterIntegrations",
})
export class FilterIntegrationsPipe implements PipeTransform {
  transform(integrations: Integration[] | null | undefined, type: IntegrationType): Integration[] {
    if (!integrations) {
      return [];
    }
    return integrations.filter((integration) => integration.type === type);
  }
}
