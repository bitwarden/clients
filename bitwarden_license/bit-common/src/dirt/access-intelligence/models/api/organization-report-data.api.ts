import { BaseResponse } from "@bitwarden/common/models/response/base.response";

/**
 * API response model returned by GET /data/report/{reportId}.
 * Maps OrganizationReportDataResponseModel from the server.
 */
export class OrganizationReportDataApi extends BaseResponse {
  reportData: string | null = null;

  constructor(data: any = null) {
    super(data);
    if (data == null) {
      return;
    }

    this.reportData = this.getResponseProperty("reportData") ?? null;
  }
}
