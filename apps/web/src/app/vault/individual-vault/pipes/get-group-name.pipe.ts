import { Pipe, PipeTransform } from "@angular/core";

import { GroupView } from "../../../admin-console/organizations/core";

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
