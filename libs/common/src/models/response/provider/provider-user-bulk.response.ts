import { Guid } from "../../../types/guid";
import { BaseResponse } from "../base.response";

export class ProviderUserBulkResponse extends BaseResponse {
  id: Guid;
  error: string;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty<Guid>("Id");
    this.error = this.getResponseProperty("Error");
  }
}
