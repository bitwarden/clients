// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore

import { FolderAddEditRequest } from "@bitwarden/sdk-internal";

import { UserId } from "../../../types/guid";
import { FolderData } from "../../models/data/folder.data";
import { Folder } from "../../models/domain/folder";
import { FolderResponse } from "../../models/response/folder.response";
import { FolderView } from "../../models/view/folder.view";

export class FolderApiServiceAbstraction {
  /**
   * Create a new folder.
   */
  create: (request: FolderAddEditRequest, userId: UserId) => Promise<FolderView>;

  save: (folder: Folder, userId: UserId) => Promise<FolderData>;
  delete: (id: string, userId: UserId) => Promise<any>;
  get: (id: string) => Promise<FolderResponse>;
  deleteAll: (userId: UserId) => Promise<void>;
}
