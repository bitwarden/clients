import { Folder } from "../domain/folder";

import { FolderRequest } from "./folder.request";

export class FolderWithIdRequest extends FolderRequest {
  id: string;

  constructor(folder: Folder) {
    super(folder);
    this.id = folder.id;
  }
}
