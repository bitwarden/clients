import { Guid } from "../../../types/guid";

type ProviderUserBulkRequestEntry = {
  id: Guid;
  key: string;
};

export class ProviderUserBulkConfirmRequest {
  keys: ProviderUserBulkRequestEntry[];

  constructor(keys: ProviderUserBulkRequestEntry[]) {
    this.keys = keys;
  }
}
