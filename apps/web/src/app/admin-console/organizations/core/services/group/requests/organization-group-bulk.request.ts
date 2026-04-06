export class OrganizationGroupBulkRequest {
  ids: string[];

  constructor(ids: string[]) {
    this.ids = ids == null ? [] : ids;
  }
}
