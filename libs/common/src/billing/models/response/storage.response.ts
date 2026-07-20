import { Storage } from "@bitwarden/subscription";

import { BaseResponse } from "../../../models/response/base.response";

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
