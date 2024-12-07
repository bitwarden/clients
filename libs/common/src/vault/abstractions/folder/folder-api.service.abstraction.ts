import { UserId } from "@bitwarden/common/types/guid";

import { Folder } from "../../models/domain/folder";
import { FolderResponse } from "../../models/response/folder.response";

export class FolderApiServiceAbstraction {
  save: (folder: Folder, userId: UserId) => Promise<any>;
  delete: (id: string, userId: UserId) => Promise<any>;
  get: (id: string) => Promise<FolderResponse>;
  deleteAll: (userId: UserId) => Promise<void>;
}
