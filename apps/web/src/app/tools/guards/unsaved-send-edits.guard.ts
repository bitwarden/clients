import { CanDeactivateFn } from "@angular/router";

import { SendComponent } from "../send/send.component";

export const unsavedSendEditsGuard: CanDeactivateFn<SendComponent> = async (component) => {
  // Angular passes null when the component has already been destroyed mid-navigation
  // (e.g. during logout teardown). No edits to save in that case — allow the navigation.
  if (component == null) {
    return true;
  }
  return component.saveUnsavedSendEdits();
};
