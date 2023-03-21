import { Guid } from "../../../types/guid";

export class CipherBulkRestoreRequest {
  ids: Guid[];

  constructor(ids: Guid[]) {
    this.ids = ids == null ? [] : ids;
  }
}
