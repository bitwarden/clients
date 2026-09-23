import Domain from "@bitwarden/common/platform/models/domain/domain-base";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { AccessReportSettingsApi } from "../api/access-report-settings.api";
import { AccessReportSettingsData } from "../data/access-report-settings.data";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { AccessReportSettingsView } from "../view/access-report-settings.view";

/**
 * Domain model for application settings data in Access Intelligence containing encrypted properties
 *
 * - See {@link AccessReportSettingsApi} for API model
 * - See {@link AccessReportSettingsData} for data model
 * - See {@link AccessReportSettingsView} from View Model
 */
export class AccessReportSettings extends Domain {
  applicationName: string = ""; // TODO: Encrypt?
  isCritical: boolean = false;
  reviewedDate?: Date;

  constructor(obj?: AccessReportSettingsData) {
    super();
    if (obj == null) {
      return;
    }

    this.applicationName = obj.applicationName;
    this.isCritical = obj.isCritical;
    this.reviewedDate = obj.reviewedDate ? new Date(obj.reviewedDate) : undefined;
  }
}
