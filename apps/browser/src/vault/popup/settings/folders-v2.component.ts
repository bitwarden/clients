import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { filter, map, Observable, switchMap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserId } from "@bitwarden/common/types/guid";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import {
  AsyncActionsModule,
  ButtonModule,
  DialogService,
  IconButtonModule,
} from "@bitwarden/components";
import { VaultIcons } from "@bitwarden/vault";

import { ItemGroupComponent } from "../../../../../../libs/components/src/item/item-group.component";
import { ItemModule } from "../../../../../../libs/components/src/item/item.module";
import { NoItemsModule } from "../../../../../../libs/components/src/no-items/no-items.module";
import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";
import {
  AddEditFolderDialogComponent,
  AddEditFolderDialogData,
} from "../components/vault-v2/add-edit-folder-dialog/add-edit-folder-dialog.component";

@Component({
  standalone: true,
  templateUrl: "./folders-v2.component.html",
  imports: [
    CommonModule,
    JslibModule,
    PopOutComponent,
    PopupPageComponent,
    PopupHeaderComponent,
    ItemModule,
    ItemGroupComponent,
    NoItemsModule,
    IconButtonModule,
    ButtonModule,
    AsyncActionsModule,
  ],
})
export class FoldersV2Component {
  folders$: Observable<FolderView[]>;

  NoFoldersIcon = VaultIcons.NoFolders;
  private activeUserId$ = this.accountService.activeAccount$.pipe(map((a) => a?.id));

  constructor(
    private folderService: FolderService,
    private dialogService: DialogService,
    private accountService: AccountService,
  ) {
    this.folders$ = this.activeUserId$.pipe(
      filter((userId): userId is UserId => userId !== null),
      switchMap((userId) => this.folderService.folderViews$(userId)),
      map((folders) => {
        // Remove the last folder, which is the "no folder" option folder
        if (folders.length > 0) {
          return folders.slice(0, folders.length - 1);
        }
        return folders;
      }),
    );
  }

  /** Open the Add/Edit folder dialog */
  openAddEditFolderDialog(folder?: FolderView) {
    // If a folder is provided, the edit variant should be shown
    const editFolderConfig = folder ? { folder } : undefined;

    this.dialogService.open<unknown, AddEditFolderDialogData>(AddEditFolderDialogComponent, {
      data: { editFolderConfig },
    });
  }
}
