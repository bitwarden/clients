import { Guid } from "../../../types/guid";

export class ProviderUserBulkRequest {
  ids: Guid[];

  constructor(ids: Guid[]) {
    this.ids = ids == null ? [] : ids;
  }
}
