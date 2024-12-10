// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Folder } from "../../models/domain/folder";
import { FolderResponse } from "../../models/response/folder.response";

export class FolderApiServiceAbstraction {
  save: (folder: Folder) => Promise<any>;
  delete: (id: string) => Promise<any>;
  get: (id: string) => Promise<FolderResponse>;
  deleteAll: () => Promise<void>;
}
