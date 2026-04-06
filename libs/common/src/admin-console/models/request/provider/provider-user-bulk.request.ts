export class ProviderUserBulkRequest {
  ids: string[];

  constructor(ids: string[]) {
    this.ids = ids == null ? [] : ids;
  }
}
