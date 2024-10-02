import { Jsonify } from "type-fest";

import { KeyService } from "../../../../../key-management/src/abstractions/key.service";
import { DeriveDefinition, FOLDER_DISK, UserKeyDefinition } from "../../../platform/state";
import { FolderService } from "../../abstractions/folder/folder.service.abstraction";
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

export const FOLDER_DECRYPTED_FOLDERS = DeriveDefinition.from<
  Record<string, FolderData>,
  FolderView[],
  { folderService: FolderService; keyService: KeyService }
>(FOLDER_ENCRYPTED_FOLDERS, {
  deserializer: (obj) => obj.map((f) => FolderView.fromJSON(f)),
  derive: async (from, { folderService, keyService }) => {
    const folders = Object.values(from || {}).map((f) => new Folder(f));

    if (await keyService.hasUserKey()) {
      return await folderService.decryptFolders(folders);
    } else {
      return [];
    }
  },
});
