export class CipherBulkMoveRequest {
  ids: string[];
  folderId: string;

  constructor(ids: string[], folderId: string) {
    this.ids = ids == null ? [] : ids;
    this.folderId = folderId;
  }
}
