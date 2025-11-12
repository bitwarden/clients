import { Jsonify } from "type-fest";

import { View } from "@bitwarden/common/models/view/view";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { RiskInsightsApplicationApi } from "../api/risk-insights-application.api";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { RiskInsightsApplicationData } from "../data/risk-insights-application.data";
import { RiskInsightsApplication } from "../domain/risk-insights-application";

/**
 * View model for Application data in Risk Insights containing decrypted properties
 *
 * - See {@link RiskInsightsApplication} for domain model
 * - See {@link RiskInsightsApplicationData} for data model
 * - See {@link RiskInsightsApplicationApi} for API model
 */
export class RiskInsightsApplicationView implements View {
  applicationName: string = "";
  isCritical = false;
  reviewedDate?: Date;

  constructor(a?: RiskInsightsApplication) {
    if (a == null) {
      return;
    }

    this.applicationName = a.applicationName;
    this.isCritical = a.isCritical;
    this.reviewedDate = a.reviewedDate;
  }

  toJSON() {
    return this;
  }

  static fromJSON(obj: Partial<Jsonify<RiskInsightsApplicationView>>): RiskInsightsApplicationView {
    return Object.assign(new RiskInsightsApplicationView(), obj);
  }

  // [TODO] SDK Mapping
  // toSdkRiskInsightsApplicationView(): SdkRiskInsightsApplicationView {}
  // static fromRiskInsightsApplicationView(obj?: SdkRiskInsightsApplicationView): RiskInsightsApplicationView | undefined {}
}
