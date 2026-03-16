import { BaseResponse } from "@bitwarden/common/models/response/base.response";
import { Storage } from "@bitwarden/subscription";

export class StorageResponse extends BaseResponse implements Storage {
  available: number;
  used: number;
  readableUsed: string;

  constructor(response: any) {
    super(response);

    this.available = this.getResponseProperty("Available");
    this.used = this.getResponseProperty("Used");
    this.readableUsed = this.getResponseProperty("ReadableUsed");
  }
}
