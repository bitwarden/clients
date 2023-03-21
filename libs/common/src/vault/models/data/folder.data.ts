import { Guid } from "../../../types/guid";
import { FolderResponse } from "../response/folder.response";

export class FolderData {
  id: Guid;
  name: string;
  revisionDate: string;

  constructor(response: FolderResponse) {
    this.name = response.name;
    this.id = response.id;
    this.revisionDate = response.revisionDate;
  }
}
