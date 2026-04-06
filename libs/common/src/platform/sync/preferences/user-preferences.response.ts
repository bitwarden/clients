import { BaseResponse } from "../../../models/response/base.response";

export class UserPreferencesResponse extends BaseResponse {
  data: string;
  revisionDate: Date;

  constructor(response: any) {
    super(response);
    this.data = this.getResponseProperty("Data");
    const revisionDateStr = this.getResponseProperty("RevisionDate");
    this.revisionDate = revisionDateStr != null ? new Date(revisionDateStr) : null;
  }
}
