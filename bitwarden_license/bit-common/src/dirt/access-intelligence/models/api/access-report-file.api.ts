import { BaseResponse } from "@bitwarden/common/models/response/base.response";
import { FileUploadType } from "@bitwarden/common/platform/enums";

import { AccessReportApi } from "./access-report.api";

/**
 * Response model returned when creating a report with the Access Intelligence V2 feature flag
 * enabled. Contains a presigned upload URL for the report file along with the created report.
 *
 * - See {@link AccessReportApi} for the nested report response model
 */
export class AccessReportFileApi extends BaseResponse {
  reportFileUploadUrl: string = "";
  reportResponse: AccessReportApi = new AccessReportApi();
  fileUploadType: FileUploadType = FileUploadType.Direct;

  constructor(data: any = null) {
    super(data);
    if (data == null) {
      return;
    }

    this.reportFileUploadUrl = this.getResponseProperty("reportFileUploadUrl") ?? "";
    const reportResponse = this.getResponseProperty("reportResponse");
    this.reportResponse =
      reportResponse != null ? new AccessReportApi(reportResponse) : new AccessReportApi();
    this.fileUploadType = this.getResponseProperty("fileUploadType") ?? FileUploadType.Direct;
  }
}
