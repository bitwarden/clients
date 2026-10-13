import { ChangeDetectionStrategy, Component, inject } from "@angular/core";

import {
  ButtonModule,
  CenterPositionStrategy,
  DialogModule,
  DialogRef,
  DialogService,
  IconTileComponent,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/** A result of the delete passkey dialog. */
export const DeletePasskeyDialogResult = Object.freeze({
  /** Delete the passkey from the login item */
  Delete: "delete",
  /** Keep the passkey */
  Cancel: "cancel",
} as const);

export type DeletePasskeyDialogResult =
  (typeof DeletePasskeyDialogResult)[keyof typeof DeletePasskeyDialogResult];

@Component({
  selector: "vault-delete-passkey-dialog",
  templateUrl: "./delete-passkey-dialog.component.html",
  imports: [ButtonModule, DialogModule, IconTileComponent, I18nPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeletePasskeyDialogComponent {
  protected readonly dialogRef = inject<DialogRef<DeletePasskeyDialogResult>>(DialogRef);

  static open(dialogService: DialogService): DialogRef<DeletePasskeyDialogResult> {
    return dialogService.open<DeletePasskeyDialogResult>(DeletePasskeyDialogComponent, {
      positionStrategy: new CenterPositionStrategy(),
    });
  }

  protected delete() {
    void this.dialogRef.close(DeletePasskeyDialogResult.Delete);
  }

  protected cancel() {
    void this.dialogRef.close(DeletePasskeyDialogResult.Cancel);
  }
}
