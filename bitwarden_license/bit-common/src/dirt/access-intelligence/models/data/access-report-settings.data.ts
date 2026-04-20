import { AccessReportSettingsApi } from "../api/access-report-settings.api";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { AccessReportSettings } from "../domain/access-report-settings";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { AccessReportSettingsView } from "../view/access-report-settings.view";

/**
 * Serializable data model for application settings data in access report
 *
 * - See {@link AccessReportSettings} for domain model
 * - See {@link AccessReportSettingsApi} for API model
 * - See {@link AccessReportSettingsView} from View Model
 */

export class AccessReportSettingsData {
  applicationName: string = "";
  isCritical: boolean = false;
  reviewedDate?: string;

  constructor(data?: AccessReportSettingsApi) {
    if (data == null) {
      return;
    }

    this.applicationName = data.applicationName;
    this.isCritical = data.isCritical;
    this.reviewedDate = data.reviewedDate;
  }
}
