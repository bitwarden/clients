import { Pipe, PipeTransform } from "@angular/core";

import { IntegrationType } from "@bitwarden/common/enums";

import { Integration } from "../../../shared/components/integrations/models";

@Pipe({
  name: "filterIntegrations",
  standalone: true,
})
export class FilterIntegrationsPipe implements PipeTransform {
  transform(integrations: Integration[], type: IntegrationType): Integration[] {
    return integrations.filter((integration) => integration.type === type);
  }
}
