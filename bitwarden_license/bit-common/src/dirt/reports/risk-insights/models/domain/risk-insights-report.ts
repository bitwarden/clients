import Domain from "@bitwarden/common/platform/models/domain/domain-base";
import { EncString } from "@bitwarden/sdk-internal";

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
  applicationName: EncString = "" as EncString;
  passwordCount: EncString = "" as EncString;
  atRiskPasswordCount: EncString = "" as EncString;
  atRiskCipherIds: string[] = [];
  memberCount: EncString = "" as EncString;
  atRiskMemberCount: EncString = "" as EncString;
  memberDetails: MemberDetails[] = [];
  atRiskMemberDetails: MemberDetails[] = [];
  cipherIds: string[] = [];

  constructor(obj?: RiskInsightsReportData) {
    super();
    if (obj == null) {
      return;
    }
    this.applicationName = obj.applicationName as EncString;
    // FIXME: the *Count fields are declared EncString but the data model holds numbers.
    // The double cast preserves the pre-existing runtime behaviour.
    this.passwordCount = obj.passwordCount as unknown as EncString;
    this.atRiskPasswordCount = obj.atRiskPasswordCount as unknown as EncString;
    this.atRiskCipherIds = obj.atRiskCipherIds;
    this.memberCount = obj.memberCount as unknown as EncString;
    this.atRiskMemberCount = obj.atRiskMemberCount as unknown as EncString;
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
