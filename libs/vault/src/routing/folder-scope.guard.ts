import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FolderService } from "@bitwarden/common/vault/abstractions/folder/folder.service.abstraction";

import {
  FOLDER_ID_PARAM,
  FOLDERS_ROUTE,
  parseVaultScope,
  VaultScopeType,
} from "../models/vault-scope";

/** Redirects `/folders/:folderId` to the My folders list when the user holds no such folder. */
export const folderScopeGuard: CanActivateFn = async (route) => {
  const router = inject(Router);
  const accountService = inject(AccountService);
  const folderService = inject(FolderService);

  const list = router.createUrlTree([`/${FOLDERS_ROUTE}`]);

  const scope = parseVaultScope(null, null, route.paramMap.get(FOLDER_ID_PARAM));
  if (scope?.type !== VaultScopeType.Folder) {
    return list;
  }

  const userId = await firstValueFrom(accountService.activeAccount$.pipe(getUserId));
  const folders = await firstValueFrom(folderService.folders$(userId));

  return folders.some((folder) => folder.id === scope.folderId) || list;
};
