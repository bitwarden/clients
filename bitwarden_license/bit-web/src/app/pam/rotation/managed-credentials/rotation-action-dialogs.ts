import { DialogService } from "@bitwarden/components";

/** The confirmations the list row menu and the detail page share, so their copy can't drift. */

/** Shown only when End active sessions is on, since the rotation then signs people out. */
export function confirmRotateNow(dialogService: DialogService): Promise<boolean> {
  return dialogService.openSimpleDialog({
    title: { key: "pamRotationConfigRotateNow" },
    content: { key: "pamRotationConfigRotateNowConfirmContent" },
    acceptButtonText: { key: "pamRotationConfigRotateNow" },
    cancelButtonText: { key: "cancel" },
    type: "warning",
  });
}

export function confirmPauseRotation(dialogService: DialogService): Promise<boolean> {
  return dialogService.openSimpleDialog({
    title: { key: "pamRotationConfigPauseRotation" },
    content: { key: "pamRotationConfigPauseContent" },
    acceptButtonText: { key: "pamRotationConfigPauseRotation" },
    cancelButtonText: { key: "cancel" },
    type: "warning",
  });
}
