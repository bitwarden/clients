import { BaseResponse } from "@bitwarden/common/models/response/base.response";
import { FileUploadType } from "@bitwarden/common/platform/enums";

import { AccessReportApi } from "./access-report.api";

/**
<<<<<<< dirt/file-persistence/pm-31942
 * Response model returned when creating a report with the Access Intelligence V2 feature flag
 * enabled. Contains a presigned upload URL for the report file along with the created report.
=======
 * Response model returned when creating an Access Intelligence report to be stored as a file.
 * Contains a presigned URL that is used to upload the file for the report.
>>>>>>> main
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
