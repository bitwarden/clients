import { ChangeDetectionStrategy, Component, inject } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  ButtonComponent,
  DIALOG_DATA,
  DialogModule,
  DialogRef,
  DialogService,
} from "@bitwarden/components";

/**
 * Marker substituted for the folder-name placeholder so the localized sentence
 * can be split around the name and the name rendered in its own italic span.
 * Uses a control character that won't appear in translated copy.
 */
const NAME_MARKER = "\u0000";

export interface DeleteSharedFolderDialogParams {
  /** Decrypted name of the shared folder being deleted. */
  folderName: string;
}

/**
 * Strongly typed helper to open the delete shared folder confirmation dialog.
 * Resolves to `true` when the user confirms the deletion, otherwise `false`.
 */
export const openDeleteSharedFolderDialog = (
  dialogService: DialogService,
  folderName: string,
): DialogRef<boolean> =>
  dialogService.open<boolean, DeleteSharedFolderDialogParams>(DeleteSharedFolderDialogComponent, {
    data: { folderName },
  });

@Component({
  templateUrl: "delete-shared-folder-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [JslibModule, DialogModule, ButtonComponent],
})
export class DeleteSharedFolderDialogComponent {
  private readonly dialogRef = inject<DialogRef<boolean>>(DialogRef);
  private readonly i18nService = inject(I18nService);
  private readonly params = inject<DeleteSharedFolderDialogParams>(DIALOG_DATA);

  protected readonly folderName = this.params.folderName;

  // The description is a single localized sentence with the folder name in the
  // middle, so translators control word order. It's split around the marker to
  // render the name in an italic span between the surrounding text.
  private readonly descriptionParts = this.i18nService
    .t("deleteSharedFolderNameDesc", NAME_MARKER)
    .split(NAME_MARKER);
  protected readonly descriptionBefore = this.descriptionParts[0] ?? "";
  protected readonly descriptionAfter = this.descriptionParts[1] ?? "";

  protected delete() {
    void this.dialogRef.close(true);
  }

  protected cancel() {
    void this.dialogRef.close(false);
  }
}
