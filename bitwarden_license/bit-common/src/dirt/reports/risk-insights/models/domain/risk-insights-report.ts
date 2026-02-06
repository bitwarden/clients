import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import Domain from "@bitwarden/common/platform/models/domain/domain-base";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { RiskInsightsReportApi } from "../api/risk-insights-report.api";
import { RiskInsightsReportData } from "../data/risk-insights-report.data";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { RiskInsightsReportView } from "../view/risk-insights-report.view";

import { MemberDetails } from "./member-details";

/**
 * Domain model for generated report data in Risk Insights containing encrypted properties
 *
 * - See {@link RiskInsightsReportApi} for API model
 * - See {@link RiskInsightsReportData} for data model
 * - See {@link RiskInsightsReportView} from View Model
 */
export class RiskInsightsReport extends Domain {
  applicationName: EncString;
  passwordCount: EncString;
  atRiskPasswordCount: EncString;
  atRiskCipherIds: string[];
  memberCount: EncString;
  atRiskMemberCount: EncString;
  memberDetails: MemberDetails[];
  atRiskMemberDetails: MemberDetails[];
  cipherIds: string[];

  constructor(obj?: RiskInsightsReportData) {
    super();
    if (obj == null) {
      return;
    }
    this.applicationName = new EncString(obj.applicationName);
    this.passwordCount = new EncString(obj.passwordCount);
    this.atRiskPasswordCount = new EncString(obj.atRiskPasswordCount);
    this.atRiskCipherIds = obj.atRiskCipherIds;
    this.memberCount = new EncString(obj.memberCount);
    this.atRiskMemberCount = new EncString(obj.atRiskMemberCount);
    this.cipherIds = obj.cipherIds;

    if (obj.memberDetails != null) {
      this.memberDetails = obj.memberDetails.map((m) => new MemberDetails(m));
    }
    if (obj.atRiskMemberDetails != null) {
      this.atRiskMemberDetails = obj.atRiskMemberDetails.map((m) => new MemberDetails(m));
    }
  }

  // [TODO] Domain level methods
  // static fromJSON(): RiskInsightsReport {}
  // decrypt(): RiskInsightsReportView {}
  // toData(): RiskInsightsReportData {}

  // [TODO] SDK Mapping
  // toSdkRiskInsightsReport(): SdkRiskInsightsReport {}
  // static fromSdkRiskInsightsReport(obj?: SdkRiskInsightsReport): RiskInsightsReport | undefined {}
}
