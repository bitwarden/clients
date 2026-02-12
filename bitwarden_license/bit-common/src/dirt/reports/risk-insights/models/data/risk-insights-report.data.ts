import { RiskInsightsReportApi } from "../api/risk-insights-report.api";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { RiskInsightsReport } from "../domain/risk-insights-report";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { RiskInsightsReportView } from "../view/risk-insights-report.view";

/**
 * Serializable data model for generated report in risk insights report
 *
 * Uses the member registry pattern with memberRefs and cipherRefs Records instead of
 * duplicated member/cipher arrays.
 *
 * - See {@link RiskInsightsReport} for domain model
 * - See {@link RiskInsightsReportApi} for API model
 * - See {@link RiskInsightsReportView} from View Model
 */
export class RiskInsightsReportData {
  applicationName: string = "";
  passwordCount: number = 0;
  atRiskPasswordCount: number = 0;

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

  memberCount: number = 0;
  atRiskMemberCount: number = 0;

  constructor(data?: RiskInsightsReportApi) {
    if (data == null) {
      return;
    }
    this.applicationName = data.applicationName;
    this.passwordCount = data.passwordCount;
    this.atRiskPasswordCount = data.atRiskPasswordCount;
    this.memberRefs = data.memberRefs ?? {};
    this.cipherRefs = data.cipherRefs ?? {};
    this.memberCount = data.memberCount;
    this.atRiskMemberCount = data.atRiskMemberCount;
  }
}
