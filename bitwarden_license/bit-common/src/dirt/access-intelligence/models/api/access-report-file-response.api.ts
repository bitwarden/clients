import { BaseResponse } from "@bitwarden/common/models/response/base.response";

import { AccessReportApi } from "./access-report.api";

/**
 * API response model returned by createReport (V2) and updateSummary (V2 when requiresNewFileUpload: true).
 * Maps OrganizationReportFileResponseModel from the server.
 */
export class AccessReportFileResponseApi extends BaseResponse {
  reportFileUploadUrl: string = "";
  reportResponse: AccessReportApi = new AccessReportApi();
  fileUploadType: number = 0; // FileUploadType: 0 = Direct, 1 = Azure

  constructor(data: any = null) {
    super(data);
    if (data == null) {
      return;
    }

    this.reportFileUploadUrl = this.getResponseProperty("reportFileUploadUrl") ?? "";
    this.fileUploadType = this.getResponseProperty("fileUploadType") ?? 0;

    const reportResponse = this.getResponseProperty("reportResponse");
    if (reportResponse != null) {
      this.reportResponse = new AccessReportApi(reportResponse);
    }
  }
}
