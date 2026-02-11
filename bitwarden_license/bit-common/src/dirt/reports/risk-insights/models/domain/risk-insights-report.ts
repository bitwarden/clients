import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import Domain from "@bitwarden/common/platform/models/domain/domain-base";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { RiskInsightsReportApi } from "../api/risk-insights-report.api";
import { RiskInsightsReportData } from "../data/risk-insights-report.data";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { RiskInsightsReportView } from "../view/risk-insights-report.view";

/**
 * Domain model for generated report data in Risk Insights containing encrypted properties
 *
 * Uses the member registry pattern with memberRefs and cipherRefs Records instead of
 * duplicated member/cipher arrays.
 *
 * - See {@link RiskInsightsReportApi} for API model
 * - See {@link RiskInsightsReportData} for data model
 * - See {@link RiskInsightsReportView} from View Model
 */
export class RiskInsightsReport extends Domain {
  applicationName: EncString = new EncString("");
  passwordCount: EncString = new EncString("");
  atRiskPasswordCount: EncString = new EncString("");

  /**
   * Member references with at-risk status
   * Record<OrganizationUserId, boolean> where value indicates at-risk status
   * Replaces: memberDetails[] + atRiskMemberDetails[]
   */
  memberRefs: Record<string, boolean> = {};

  /**
   * Cipher references with at-risk status
   * Record<CipherId, boolean> where value indicates at-risk status
   * Replaces: cipherIds[] + atRiskCipherIds[]
   */
  cipherRefs: Record<string, boolean> = {};

  memberCount: EncString = new EncString("");
  atRiskMemberCount: EncString = new EncString("");

  constructor(obj?: RiskInsightsReportData) {
    super();
    if (obj == null) {
      return;
    }
    this.applicationName = new EncString(obj.applicationName);
    this.passwordCount = new EncString(obj.passwordCount);
    this.atRiskPasswordCount = new EncString(obj.atRiskPasswordCount);
    this.memberRefs = obj.memberRefs ?? {};
    this.cipherRefs = obj.cipherRefs ?? {};
    this.memberCount = new EncString(obj.memberCount);
    this.atRiskMemberCount = new EncString(obj.atRiskMemberCount);
  }

  // [TODO] Domain level methods
  // static fromJSON(): RiskInsightsReport {}
  // decrypt(): RiskInsightsReportView {}
  // toData(): RiskInsightsReportData {}

  // [TODO] SDK Mapping
  // toSdkRiskInsightsReport(): SdkRiskInsightsReport {}
  // static fromSdkRiskInsightsReport(obj?: SdkRiskInsightsReport): RiskInsightsReport | undefined {}
}
