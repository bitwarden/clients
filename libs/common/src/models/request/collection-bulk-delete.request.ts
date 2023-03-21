import { Guid } from "../../types/guid";

export class CollectionBulkDeleteRequest {
  ids: Guid[];
  organizationId: Guid;

  constructor(ids: Guid[], organizationId?: Guid) {
    this.ids = ids == null ? [] : ids;
    this.organizationId = organizationId;
  }
}
