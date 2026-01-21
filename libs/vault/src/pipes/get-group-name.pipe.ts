import { Pipe, PipeTransform } from "@angular/core";

import { GroupView } from "@bitwarden/common/admin-console/views/organization/group.view";

@Pipe({
  name: "groupNameFromId",
  pure: true,
  standalone: false,
})
export class GetGroupNameFromIdPipe implements PipeTransform {
  transform(value: string, groups: GroupView[]) {
    return groups.find((o) => o.id === value)?.name;
  }
}
