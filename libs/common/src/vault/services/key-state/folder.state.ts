import { firstValueFrom } from "rxjs";
import { Jsonify } from "type-fest";

import { EncryptService } from "@bitwarden/common/platform/abstractions/encrypt.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { UserId } from "@bitwarden/common/types/guid";
import { KeyService } from "@bitwarden/key-management";

import { DeriveDefinition, FOLDER_DISK, UserKeyDefinition } from "../../../platform/state";
import { FolderData } from "../../models/data/folder.data";
import { Folder } from "../../models/domain/folder";
import { FolderView } from "../../models/view/folder.view";

export const FOLDER_ENCRYPTED_FOLDERS = UserKeyDefinition.record<FolderData>(
  FOLDER_DISK,
  "folders",
  {
    deserializer: (obj: Jsonify<FolderData>) => FolderData.fromJSON(obj),
    clearOn: ["logout"],
  },
);

export const FOLDER_DECRYPTED_FOLDERS = new DeriveDefinition<
  [UserId, Record<string, FolderData>],
  FolderView[],
  {
    encryptService: EncryptService;
    i18nService: I18nService;
    keyService: KeyService;
  }
>(FOLDER_DISK, "decryptedFolders", {
  deserializer: (obj) => obj.map((f) => FolderView.fromJSON(f)),
  derive: async ([userId, folderData], { encryptService, i18nService, keyService }) => {
    if (!folderData) {
      return [];
    }

    const folders = Object.values(folderData).map((f) => new Folder(f));

    const userKey = await firstValueFrom(keyService.userKey$(userId));
    if (!userKey) {
      return [];
    }

    const decryptFolderPromises = folders.map((f) => f.decryptWithKey(userKey, encryptService));
    const decryptedFolders = await Promise.all(decryptFolderPromises);

    decryptedFolders.sort(Utils.getSortFunction(i18nService, "name"));

    const noneFolder = new FolderView();
    noneFolder.name = i18nService.t("noneFolder");
    decryptedFolders.push(noneFolder);

    return decryptedFolders;
  },
});
