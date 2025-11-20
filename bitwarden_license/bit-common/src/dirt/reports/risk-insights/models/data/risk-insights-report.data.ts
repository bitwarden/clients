import { RiskInsightsReportApi } from "../api/risk-insights-report.api";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { RiskInsightsReport } from "../domain/risk-insights-report";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { RiskInsightsReportView } from "../view/risk-insights-report.view";

import { MemberDetailsData } from "./member-details.data";

/**
 * Serializable data model for generated report in risk insights report
 *
 * - See {@link RiskInsightsReport} for domain model
 * - See {@link RiskInsightsReportApi} for API model
 * - See {@link RiskInsightsReportView} from View Model
 */
export class RiskInsightsReportData {
  applicationName: string;
  passwordCount: number;
  atRiskPasswordCount: number;
  atRiskCipherIds: string[];
  memberCount: number;
  atRiskMemberCount: number;
  memberDetails: MemberDetailsData[];
  atRiskMemberDetails: MemberDetailsData[];
  cipherIds: string[];

  constructor(data?: RiskInsightsReportApi) {
    if (data == null) {
      return;
    }
    this.applicationName = data.applicationName;
    this.passwordCount = data.passwordCount;
    this.atRiskPasswordCount = data.atRiskPasswordCount;
    this.atRiskCipherIds = data.atRiskCipherIds;
    this.memberCount = data.memberCount;
    this.atRiskMemberCount = data.atRiskMemberCount;
    this.memberDetails = data.memberDetails;
    this.atRiskMemberDetails = data.atRiskMemberDetails;
    this.cipherIds = data.cipherIds;

    if (data.memberDetails != null) {
      this.memberDetails = data.memberDetails.map((m) => new MemberDetailsData(m));
    }
    if (data.atRiskMemberDetails != null) {
      this.atRiskMemberDetails = data.atRiskMemberDetails.map((m) => new MemberDetailsData(m));
    }
  }
}
