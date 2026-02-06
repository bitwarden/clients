import Domain from "@bitwarden/common/platform/models/domain/domain-base";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { RiskInsightsApplicationApi } from "../api/risk-insights-application.api";
import { RiskInsightsApplicationData } from "../data/risk-insights-application.data";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { RiskInsightsApplicationView } from "../view/risk-insights-application.view";

/**
 * Domain model for Application data in Risk Insights containing encrypted properties
 *
 * - See {@link RiskInsightsApplicationApi} for API model
 * - See {@link RiskInsightsApplicationData} for data model
 * - See {@link RiskInsightsApplicationView} from View Model
 */
export class RiskInsightsApplication extends Domain {
  applicationName: string = ""; // TODO: Encrypt?
  isCritical: boolean = false;
  reviewedDate?: Date;

  constructor(obj?: RiskInsightsApplicationData) {
    super();
    if (obj == null) {
      return;
    }

    this.applicationName = obj.applicationName;
    this.isCritical = obj.isCritical;
    this.reviewedDate = new Date(obj.reviewedDate);
  }
}
