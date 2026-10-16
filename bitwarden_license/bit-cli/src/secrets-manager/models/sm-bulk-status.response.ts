import { BulkOperationStatus } from "@bitwarden/bit-common/secrets-manager/models/bulk-operation-status";
import { BaseResponse } from "@bitwarden/cli/models/response/base.response";

export class SmBulkStatusResponse implements BaseResponse {
  object = "sm-bulk-status";

  id: string;
  name: string;
  error?: string;

  constructor(status: BulkOperationStatus) {
    this.id = status.id;
    this.name = status.name;
    if (status.errorMessage) {
      this.error = status.errorMessage;
    }
  }
}
