import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { View } from "@bitwarden/common/models/view/view";
import { DeepJsonify } from "@bitwarden/common/types/deep-jsonify";
import { OrganizationId, OrganizationReportId } from "@bitwarden/common/types/guid";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { RiskInsightsApi } from "../api/risk-insights.api";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { RiskInsightsData } from "../data/risk-insights.data";
import { RiskInsights } from "../domain/risk-insights";

import { RiskInsightsApplicationView } from "./risk-insights-application.view";
import { RiskInsightsReportView } from "./risk-insights-report.view";
import { RiskInsightsSummaryView } from "./risk-insights-summary.view";

/**
 * View model for Member Details in Risk Insights containing decrypted properties
 *
 * - See {@link RiskInsights} for domain model
 * - See {@link RiskInsightsData} for data model
 * - See {@link RiskInsightsApi} for API model
 */
export class RiskInsightsView implements View {
  id: OrganizationReportId = "" as OrganizationReportId;
  organizationId: OrganizationId = "" as OrganizationId;
  reports: RiskInsightsReportView[] = [];
  applications: RiskInsightsApplicationView[] = [];
  summary = new RiskInsightsSummaryView();
  creationDate: Date;
  contentEncryptionKey?: EncString;

  constructor(report?: RiskInsights) {
    if (!report) {
      this.creationDate = new Date();
      return;
    }

    this.id = report.id as OrganizationReportId;
    this.organizationId = report.organizationId as OrganizationId;
    this.creationDate = report.creationDate;
    this.contentEncryptionKey = report.contentEncryptionKey;
  }

  toJSON() {
    return this;
  }

  static fromJSON(obj: Partial<DeepJsonify<RiskInsightsView>> | null): RiskInsightsView {
    if (obj == undefined) {
      return new RiskInsightsView();
    }

    const view = Object.assign(new RiskInsightsView(), obj) as RiskInsightsView;

    view.reports = obj.reports?.map((report) => RiskInsightsReportView.fromJSON(report)) ?? [];
    view.applications = obj.applications?.map((a) => RiskInsightsApplicationView.fromJSON(a)) ?? [];
    view.summary = RiskInsightsSummaryView.fromJSON(obj.summary);

    return view;
  }

  // [TODO] SDK Mapping
  // toSdkRiskInsightsView(): SdkRiskInsightsView {}
  // static fromRiskInsightsView(obj?: SdkRiskInsightsView): RiskInsightsView | undefined {}
}
