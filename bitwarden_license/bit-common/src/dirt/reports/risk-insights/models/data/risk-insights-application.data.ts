import { RiskInsightsApplicationApi } from "../api/risk-insights-application.api";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { RiskInsightsApplication } from "../domain/risk-insights-application";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { RiskInsightsApplicationView } from "../view/risk-insights-application.view";

/**
 * Serializable data model for Application data in risk insights report
 *
 * - See {@link RiskInsightsApplication} for domain model
 * - See {@link RiskInsightsApplicationApi} for API model
 * - See {@link RiskInsightsApplicationView} from View Model
 */

export class RiskInsightsApplicationData {
  applicationName: string;
  isCritical: boolean;
  reviewedDate: string | undefined;

  constructor(data?: RiskInsightsApplicationApi) {
    if (data == null) {
      return;
    }

    this.applicationName = data.applicationName;
    this.isCritical = data.isCritical;
    this.reviewedDate = data.reviewedDate;
  }
}
