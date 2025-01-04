import { Component } from "@angular/core";
import { Router } from "@angular/router";
import { filter, map, Observable, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserId } from "@bitwarden/common/types/guid";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";

@Component({
  selector: "app-folders",
  templateUrl: "folders.component.html",
})
export class FoldersComponent {
  folders$: Observable<FolderView[]>;

  private activeUserId$ = this.accountService.activeAccount$.pipe(map((a) => a?.id));

  constructor(
    private folderService: FolderService,
    private router: Router,
    private accountService: AccountService,
  ) {
    this.folders$ = this.activeUserId$.pipe(
      filter((userId): userId is UserId => userId != null),
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

  folderSelected(folder: FolderView) {
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.router.navigate(["/edit-folder"], { queryParams: { folderId: folder.id } });
  }

  addFolder() {
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.router.navigate(["/add-folder"]);
  }
}
