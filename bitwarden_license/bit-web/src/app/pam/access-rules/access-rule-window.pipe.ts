import { Pipe, PipeTransform } from "@angular/core";

import { AccessRuleView, AccessRuleWindow, accessRuleWindow } from "..";

/** A rule's lease window for display, or null when it has none. See {@link accessRuleWindow}. */
@Pipe({ name: "accessRuleWindow" })
export class AccessRuleWindowPipe implements PipeTransform {
  transform(rule: AccessRuleView): AccessRuleWindow | null {
    return accessRuleWindow(rule);
  }
}
