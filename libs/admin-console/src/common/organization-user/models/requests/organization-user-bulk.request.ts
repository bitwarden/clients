export class OrganizationUserBulkRequest {
  ids: string[];

  constructor(ids: string[]) {
    this.ids = ids == null ? [] : ids;
  }
}
