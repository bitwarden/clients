type ProviderUserBulkRequestEntry = {
  id: string;
  key: string;
};

export class ProviderUserBulkConfirmRequest {
  keys: ProviderUserBulkRequestEntry[];

  constructor(keys: ProviderUserBulkRequestEntry[]) {
    this.keys = keys;
  }
}
