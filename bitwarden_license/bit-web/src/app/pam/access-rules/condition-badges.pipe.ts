import { Pipe, PipeTransform } from "@angular/core";

import { AccessCondition, ConditionBadge, conditionBadges } from "..";

/** Projects a rule's conditions into presentation badges. See {@link conditionBadges}. */
@Pipe({ name: "conditionBadges" })
export class ConditionBadgesPipe implements PipeTransform {
  transform(conditions: AccessCondition[]): ConditionBadge[] {
    return conditionBadges(conditions);
  }
}
