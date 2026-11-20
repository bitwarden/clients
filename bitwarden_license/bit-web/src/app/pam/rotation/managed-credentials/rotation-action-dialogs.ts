import { firstValueFrom } from "rxjs";

import { CenterPositionStrategy, DialogService } from "@bitwarden/components";

import {
  RotationWarningDialogComponent,
  RotationWarningDialogParams,
} from "./rotation-warning-dialog.component";

/** The confirmations the list row menu and the detail page share, so their copy can't drift. */

async function confirmWarning(
  dialogService: DialogService,
  params: RotationWarningDialogParams,
): Promise<boolean> {
  const ref = dialogService.open<boolean | undefined, RotationWarningDialogParams>(
    RotationWarningDialogComponent,
    { data: params, positionStrategy: new CenterPositionStrategy() },
  );
  return (await firstValueFrom(ref.closed, { defaultValue: undefined })) === true;
}

/** Shown only when End active sessions is on, since the rotation then signs people out. */
export function confirmRotateNow(dialogService: DialogService): Promise<boolean> {
  return confirmWarning(dialogService, {
    titleKey: "pamRotationConfigRotateNow",
    contentKey: "pamRotationConfigRotateNowConfirmContent",
    acceptButtonKey: "pamRotationConfigRotateNow",
  });
}

export function confirmPauseRotation(dialogService: DialogService): Promise<boolean> {
  return confirmWarning(dialogService, {
    titleKey: "pamRotationConfigPauseRotation",
    contentKey: "pamRotationConfigPauseContent",
    acceptButtonKey: "pamRotationConfigPauseRotation",
  });
}

export function confirmRemoveFromRotation(dialogService: DialogService): Promise<boolean> {
  return confirmWarning(dialogService, {
    titleKey: "pamRotationConfigRemoveConfirmTitle",
    contentKey: "pamRotationConfigRemoveConfirmContent",
    acceptButtonKey: "pamRotationConfigRemoveFromRotation",
  });
}
