import { CanDeactivateFn } from "@angular/router";

import { SendComponent } from "../send/send.component";

export const unsavedSendEditsGuard: CanDeactivateFn<SendComponent> = async (component) => {
  // If the component is null (during logout, for instance) we don't want the guard
  // to crash. Instead we let the navigation happen, possibly losing unsaved edits
  // but keeping the app running
  return component?.saveUnsavedSendEdits() ?? true;
};
