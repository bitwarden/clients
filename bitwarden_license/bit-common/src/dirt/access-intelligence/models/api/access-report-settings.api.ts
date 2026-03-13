import { BaseResponse } from "@bitwarden/common/models/response/base.response";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { AccessReportSettingsData } from "../data/access-report-settings.data";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { AccessReportSettings } from "../domain/access-report-settings";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { AccessReportSettingsView } from "../view/access-report-settings.view";

/**
 * Converts an AccessReportSettings API response
 *
 * - See {@link AccessReportSettings} for domain model
 * - See {@link AccessReportSettingsData} for data model
 * - See {@link AccessReportSettingsView} from View Model
 */
export class AccessReportSettingsApi extends BaseResponse {
  applicationName: string = "";
  isCritical: boolean = false;
  reviewedDate: string | undefined;

  constructor(data: any) {
    super(data);
    if (data == null) {
      return;
    }

    this.applicationName = this.getResponseProperty("applicationName");
    this.isCritical = this.getResponseProperty("isCritical") ?? false;
    this.reviewedDate = this.getResponseProperty("reviewedDate");
  }
}
