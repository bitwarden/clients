// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Folder } from "../domain/folder";

export class FolderRequest {
  name: string;

  constructor(folder: Folder) {
    this.name = folder.name ? folder.name.encryptedString : null;
  }
}
