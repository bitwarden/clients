import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { filter, map, Observable, switchMap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { NoFolders } from "@bitwarden/assets/svg";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserId } from "@bitwarden/common/types/guid";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import {
  AsyncActionsModule,
  ButtonModule,
  DialogService,
  IconButtonModule,
  ItemModule,
  NoItemsModule,
} from "@bitwarden/components";
import { AddEditFolderDialogComponent } from "@bitwarden/vault";

import { PopOutComponent } from "../../../platform/popup/components/pop-out.component";
import { PopupHeaderComponent } from "../../../platform/popup/layout/popup-header.component";
import { PopupPageComponent } from "../../../platform/popup/layout/popup-page.component";

@Component({
  templateUrl: "./folders-v2.component.html",
  imports: [
    CommonModule,
    JslibModule,
    PopOutComponent,
    PopupPageComponent,
    PopupHeaderComponent,
    ItemModule,
    NoItemsModule,
    IconButtonModule,
    ButtonModule,
    AsyncActionsModule,
  ],
})
export class FoldersV2Component {
  folders$: Observable<FolderView[]>;

  NoFoldersIcon = NoFolders;
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

    AddEditFolderDialogComponent.open(this.dialogService, { editFolderConfig });
  }
}
