type OrganizationUserBulkRequestEntry = {
  id: string;
  key: string;
};

export class OrganizationUserBulkConfirmRequest {
  keys: OrganizationUserBulkRequestEntry[];

  constructor(keys: OrganizationUserBulkRequestEntry[]) {
    this.keys = keys;
  }
}
