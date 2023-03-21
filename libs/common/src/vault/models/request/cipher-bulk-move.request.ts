import { Guid } from "../../../types/guid";

export class CipherBulkMoveRequest {
  ids: Guid[];
  folderId: Guid;

  constructor(ids: Guid[], folderId: Guid) {
    this.ids = ids == null ? [] : ids;
    this.folderId = folderId;
  }
}
