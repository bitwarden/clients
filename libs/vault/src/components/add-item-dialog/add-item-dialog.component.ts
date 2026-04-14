import { ChangeDetectionStrategy, Component, inject } from "@angular/core";

import { CipherType } from "@bitwarden/common/vault/enums";
import { UnionOfValues } from "@bitwarden/common/vault/types/union-of-values";
import { DIALOG_DATA, DialogModule, DialogRef, DialogService } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { AddItemGridComponent } from "../add-item-grid/add-item-grid.component";

export const AddItemDialogResult = Object.freeze({
  Cipher: "cipher",
  Folder: "folder",
  Collection: "collection",
} as const);

export type AddItemDialogResult = UnionOfValues<typeof AddItemDialogResult>;

export type AddItemDialogCloseResult =
  | { result: typeof AddItemDialogResult.Cipher; cipherType: CipherType }
  | { result: typeof AddItemDialogResult.Folder }
  | { result: typeof AddItemDialogResult.Collection };

export type AddItemDialogData = {
  canCreateFolder: boolean;
  canCreateCollection: boolean;
  canCreateSshKey: boolean;
};

@Component({
  selector: "vault-add-item-dialog",
  templateUrl: "./add-item-dialog.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DialogModule, I18nPipe, AddItemGridComponent],
})
export class AddItemDialogComponent {
  protected readonly dialogRef = inject<DialogRef<AddItemDialogCloseResult>>(DialogRef);
  protected readonly data = inject<AddItemDialogData>(DIALOG_DATA);

  protected onCipherSelected(cipherType: CipherType): void {
    this.dialogRef.close({ result: AddItemDialogResult.Cipher, cipherType });
  }

  protected onFolderSelected(): void {
    this.dialogRef.close({ result: AddItemDialogResult.Folder });
  }

  protected onCollectionSelected(): void {
    this.dialogRef.close({ result: AddItemDialogResult.Collection });
  }

  static open(
    dialogService: DialogService,
    data: AddItemDialogData,
  ): DialogRef<AddItemDialogCloseResult> {
    return dialogService.open<AddItemDialogCloseResult, AddItemDialogData>(AddItemDialogComponent, {
      data,
    });
  }
}
