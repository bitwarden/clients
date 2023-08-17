import { arrayInitialize, assignPrototype } from "@bitwarden/common/platform/misc/initializers";
import { Folder } from "@bitwarden/common/vault/models/domain/folder";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { FolderService } from "@bitwarden/common/vault/services/folder/folder.service";

import { BackgroundBitSubject } from "../../../platform/utils/background-bit-subject";

export class BackgroundFolderService extends FolderService {
  protected _folders = new BackgroundBitSubject<Folder[]>(
    "folderService_folders",
    arrayInitialize(Folder.fromKeyValuePair)
  );
  protected _folderViews = new BackgroundBitSubject<FolderView[]>(
    "folderService_folderViews",
    arrayInitialize(assignPrototype(FolderView))
  );
}
