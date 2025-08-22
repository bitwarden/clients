import { Pipe, PipeTransform } from "@angular/core";

import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";

@Pipe({
  name: "orgNameFromId",
  pure: true,
  standalone: false,
})
export class GetOrgNameFromIdPipe implements PipeTransform {
  transform(value: string, organizations: Organization[]) {
    const orgName = organizations?.find((o) => o.id === value)?.name;
    return orgName;
  }
}
