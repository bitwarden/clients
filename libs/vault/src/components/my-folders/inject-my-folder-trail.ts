import { computed, inject, Signal } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { map, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";

import { MyFolderTrail, resolveMyFolderTrail } from "../../utils/my-folder-trail";

/**
 * {@link resolveMyFolderTrail} for the folder {@link folderId} names, resolved against the active
 * account's folders. `undefined` for a folder the user does not hold.
 *
 * Must be called in an injection context.
 */
export function injectMyFolderTrail(folderId: Signal<string>): Signal<MyFolderTrail | undefined> {
  const accountService = inject(AccountService);
  const folderService = inject(FolderService);

  const folders = toSignal(
    accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => folderService.folderViews$(userId)),
      // The "No folder" entry has no id and is not a folder the user can be in.
      map((folders) => folders.filter((folder) => folder.id != null && folder.id !== "")),
    ),
    { initialValue: [] as FolderView[] },
  );

  return computed(() => resolveMyFolderTrail(folders(), folderId()));
}
