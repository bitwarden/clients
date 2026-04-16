import { ChangeDetectionStrategy, Component, inject } from "@angular/core";

import { DIALOG_DATA, DialogModule, DialogRef, DialogService } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { AddItemGridComponent, AddItemGridResult } from "../add-item-grid/add-item-grid.component";

export { AddItemGridResult as AddItemDialogResult } from "../add-item-grid/add-item-grid.component";
export type AddItemDialogCloseResult = AddItemGridResult;

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

  protected onItemSelected(closeResult: AddItemDialogCloseResult): void {
    this.dialogRef.close(closeResult);
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
