import { Folder } from "../domain/folder";

export class FolderRequest {
  name: string;

  constructor(folder: Folder) {
    if (folder.name == null) {
      throw new Error("Folder name is required");
    }
    this.name = folder.name;
  }
}
