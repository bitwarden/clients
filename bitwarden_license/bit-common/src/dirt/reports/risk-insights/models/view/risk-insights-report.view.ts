import { View } from "@bitwarden/common/models/view/view";
import { DeepJsonify } from "@bitwarden/common/types/deep-jsonify";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { RiskInsightsReportApi } from "../api/risk-insights-report.api";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { RiskInsightsReportData } from "../data/risk-insights-report.data";
import { RiskInsightsReport } from "../domain/risk-insights-report";

import { MemberDetailsView } from "./member-details.view";

/**
 * View model for Member Details in Risk Insights containing decrypted properties
 *
 * - See {@link RiskInsightsReport} for domain model
 * - See {@link RiskInsightsReportData} for data model
 * - See {@link RiskInsightsReportApi} for API model
 */
export class RiskInsightsReportView implements View {
  applicationName: string = "";
  passwordCount: number = 0;
  atRiskPasswordCount: number = 0;
  atRiskCipherIds: string[] = [];
  memberCount: number = 0;
  atRiskMemberCount: number = 0;
  memberDetails: MemberDetailsView[] = [];
  atRiskMemberDetails: MemberDetailsView[] = [];
  cipherIds: string[] = [];

  constructor(r?: RiskInsightsReport) {
    if (r == null) {
      return;
    }
  }

  toJSON() {
    return this;
  }

  static fromJSON(
    obj: Partial<DeepJsonify<RiskInsightsReportView>> | undefined,
  ): RiskInsightsReportView {
    if (obj == undefined) {
      return new RiskInsightsReportView();
    }

    const view = Object.assign(new RiskInsightsReportView(), obj) as RiskInsightsReportView;

    view.memberDetails = obj.memberDetails?.map((m: any) => MemberDetailsView.fromJSON(m)) ?? [];
    view.atRiskMemberDetails =
      obj.atRiskMemberDetails?.map((m: any) => MemberDetailsView.fromJSON(m)) ?? [];

    return view;
  }

  // [TODO] SDK Mapping
  // toSdkRiskInsightsReportView(): SdkRiskInsightsReportView {}
  // static fromRiskInsightsReportView(obj?: SdkRiskInsightsReportView): RiskInsightsReportView | undefined {}
}
