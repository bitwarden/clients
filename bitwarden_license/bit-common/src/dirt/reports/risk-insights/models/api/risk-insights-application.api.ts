import { BaseResponse } from "@bitwarden/common/models/response/base.response";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { RiskInsightsApplicationData } from "../data/risk-insights-application.data";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { RiskInsightsApplication } from "../domain/risk-insights-application";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { RiskInsightsApplicationView } from "../view/risk-insights-application.view";

/**
 * Converts a RiskInsightsApplication API response
 *
 * - See {@link RiskInsightsApplication} for domain model
 * - See {@link RiskInsightsApplicationData} for data model
 * - See {@link RiskInsightsApplicationView} from View Model
 */
export class RiskInsightsApplicationApi extends BaseResponse {
  applicationName: string;
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
