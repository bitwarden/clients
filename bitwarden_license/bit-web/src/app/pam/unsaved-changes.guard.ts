import { inject } from "@angular/core";
import { CanDeactivateFn } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { DialogService, SimpleDialogOptions } from "@bitwarden/components";

/** Default discard dialog props. */
const discardDialog: SimpleDialogOptions = Object.freeze({
  title: { key: "discardEditsTitle" },
  content: { key: "discardEditsConfirmation" },
  acceptButtonText: { key: "discardEdits" },
  cancelButtonText: { key: "backToEditing" },
  type: "danger",
  hideIcon: true,
});

/** A routed component whose unsaved input the guard asks about with a discard dialog. */
export interface HasUnsavedChangesDialog {
  /**
   * `false` when there is nothing to lose, `true` to ask with the default discard dialog, or
   * options overriding parts of it.
   */
  unsavedChanges(): boolean | Partial<SimpleDialogOptions>;
}

/** Shows a discard dialog when the component reports unsaved changes. */
export const unsavedChangesDialogGuard: CanDeactivateFn<HasUnsavedChangesDialog> = (component) => {
  const dialogService = inject(DialogService);

  return leaveUnlessLocked(component, (target) => {
    const changes = target.unsavedChanges();
    if (changes === false) {
      return true;
    }

    const overrides = changes === true ? {} : changes;
    return dialogService.openSimpleDialog({ ...discardDialog, ...overrides });
  });
};

/**
 * Lock and logout always win. The guard lets those through without asking, as it does when
 * Angular passes no component during teardown.
 */
async function leaveUnlessLocked<T>(
  component: T | null,
  confirm: (component: T) => boolean | Promise<boolean>,
): Promise<boolean> {
  const authService = inject(AuthService);

  if (component == null) {
    return true;
  }

  const status = await firstValueFrom(authService.activeAccountStatus$);
  if (status !== AuthenticationStatus.Unlocked) {
    return true;
  }

  return await confirm(component);
}
