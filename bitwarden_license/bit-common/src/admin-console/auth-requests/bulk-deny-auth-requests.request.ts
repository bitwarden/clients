export class BulkDenyAuthRequestsRequest {
  private ids: string[];
  constructor(authRequestIds: string[]) {
    this.ids = authRequestIds;
  }
}
