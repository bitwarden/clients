// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore

import { UserId } from "../../../types/guid";
import { FolderData } from "../../models/data/folder.data";
import { Folder } from "../../models/domain/folder";
import { FolderResponse } from "../../models/response/folder.response";

export class FolderApiServiceAbstraction {
  save: (folder: Folder, userId: UserId) => Promise<FolderData>;
  delete: (id: string, userId: UserId) => Promise<any>;
  get: (id: string) => Promise<FolderResponse>;
  deleteAll: (userId: UserId) => Promise<void>;
}
