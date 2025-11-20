import { BaseResponse } from "@bitwarden/common/models/response/base.response";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { RiskInsightsReportData } from "../data/risk-insights-report.data";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { RiskInsightsReport } from "../domain/risk-insights-report";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { RiskInsightsReportView } from "../view/risk-insights-report.view";

import { MemberDetailsApi } from "./member-details.api";

/**
 * Converts a RiskInsightsReport API response
 *
 * - See {@link RiskInsightsReport} for domain model
 * - See {@link RiskInsightsReportData} for data model
 * - See {@link RiskInsightsReportView} from View Model
 */
export class RiskInsightsReportApi extends BaseResponse {
  applicationName: string;
  passwordCount: number;
  atRiskPasswordCount: number;
  atRiskCipherIds: string[];
  memberCount: number;
  atRiskMemberCount: number;
  memberDetails: MemberDetailsApi[];
  atRiskMemberDetails: MemberDetailsApi[];
  cipherIds: string[];

  constructor(data: any) {
    super(data);
    if (data == null) {
      return;
    }

    this.applicationName = this.getResponseProperty("applicationName");
    this.passwordCount = this.getResponseProperty("passwordCount");
    this.atRiskPasswordCount = this.getResponseProperty("atRiskPasswordCount");
    this.atRiskCipherIds = this.getResponseProperty("atRiskCipherIds");
    this.memberCount = this.getResponseProperty("memberCount");
    this.atRiskMemberCount = this.getResponseProperty("atRiskMemberCount");
    this.cipherIds = this.getResponseProperty("cipherIds");

    const memberDetails = this.getResponseProperty("memberDetails");
    if (memberDetails != null) {
      this.memberDetails = memberDetails.map((f: any) => new MemberDetailsApi(f));
    }
    const atRiskMemberDetails = this.getResponseProperty("atRiskMemberDetails");
    if (atRiskMemberDetails != null) {
      this.atRiskMemberDetails = atRiskMemberDetails.map((f: any) => new MemberDetailsApi(f));
    }
  }
}
