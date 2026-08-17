import { Pipe, PipeTransform } from "@angular/core";

import { AccessCondition, approvalMethodLabelKey } from "..";

/** Projects a rule's conditions into its approval-method label key. */
@Pipe({ name: "approvalMethod" })
export class ApprovalMethodPipe implements PipeTransform {
  transform(conditions: AccessCondition[]): string {
    return approvalMethodLabelKey(conditions);
  }
}
