import { ChangeDetectionStrategy, Component, inject } from "@angular/core";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  ButtonComponent,
  DIALOG_DATA,
  DialogModule,
  DialogRef,
  DialogService,
  IconComponent,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/**
 * Marker substituted for the folder-name placeholder so the localized sentence
 * can be split around the name and the name rendered in its own italic span.
 * Uses a control character that won't appear in translated copy.
 */
const NAME_MARKER = "\u0000";

/** One folder is named in the copy; several are referred to by count alone. */
export type DeleteFolderDialogParams = { folderName: string } | { count: number };

/**
 * Confirmation for deleting my folders. Resolves to `true` when the user confirms the deletion,
 * otherwise `false`.
 */
export const openDeleteFolderDialog = (
  dialogService: DialogService,
  params: DeleteFolderDialogParams,
): DialogRef<boolean> =>
  dialogService.open<boolean, DeleteFolderDialogParams>(DeleteFolderDialogComponent, {
    data: params,
  });

@Component({
  templateUrl: "delete-folder-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogModule, ButtonComponent, IconComponent, I18nPipe],
})
export class DeleteFolderDialogComponent {
  private readonly dialogRef = inject<DialogRef<boolean>>(DialogRef);
  private readonly i18nService = inject(I18nService);
  private readonly params = inject<DeleteFolderDialogParams>(DIALOG_DATA);

  protected readonly folderName = "folderName" in this.params ? this.params.folderName : undefined;

  protected readonly title =
    "folderName" in this.params
      ? this.i18nService.t("deleteFolder")
      : this.i18nService.t("deleteFoldersCount", this.params.count);

  // The single-folder description is one localized sentence with the name in the middle, so
  // translators control word order. It's split around the marker to render the name in an italic
  // span between the surrounding text.
  private readonly descriptionParts = this.folderName
    ? this.i18nService.t("deleteFolderDescription", NAME_MARKER).split(NAME_MARKER)
    : [this.i18nService.t("deleteFoldersDescription")];

  protected readonly descriptionBefore = this.descriptionParts[0] ?? "";
  protected readonly descriptionAfter = this.descriptionParts[1] ?? "";

  protected delete() {
    void this.dialogRef.close(true);
  }

  protected cancel() {
    void this.dialogRef.close(false);
  }
}
