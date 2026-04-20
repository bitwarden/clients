import { CanDeactivateFn } from "@angular/router";

import { SendComponent } from "../send.component";

export const unsavedSendEditsGuard: CanDeactivateFn<SendComponent> = async (component) => {
  return component.saveUnsavedSendEdits();
};
