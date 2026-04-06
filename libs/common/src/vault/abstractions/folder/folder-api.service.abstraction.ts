import { UserId } from "../../../types/guid";
import { FolderData } from "../../models/data/folder.data";
import { Folder } from "../../models/domain/folder";
import { FolderResponse } from "../../models/response/folder.response";

export abstract class FolderApiServiceAbstraction {
  abstract save(folder: Folder, userId: UserId): Promise<FolderData>;
  abstract delete(id: string, userId: UserId): Promise<any>;
  abstract get(id: string): Promise<FolderResponse>;
  abstract deleteAll(userId: UserId): Promise<void>;
}
