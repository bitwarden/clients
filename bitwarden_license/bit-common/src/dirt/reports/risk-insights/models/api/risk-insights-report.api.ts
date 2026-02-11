import { BaseResponse } from "@bitwarden/common/models/response/base.response";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { RiskInsightsReportData } from "../data/risk-insights-report.data";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { RiskInsightsReport } from "../domain/risk-insights-report";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { RiskInsightsReportView } from "../view/risk-insights-report.view";

/**
 * Converts a RiskInsightsReport API response
 *
 * Uses the member registry pattern with memberRefs and cipherRefs Records instead of
 * duplicated member/cipher arrays.
 *
 * - See {@link RiskInsightsReport} for domain model
 * - See {@link RiskInsightsReportData} for data model
 * - See {@link RiskInsightsReportView} from View Model
 */
export class RiskInsightsReportApi extends BaseResponse {
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

  constructor(data: any) {
    super(data);
    if (data == null) {
      return;
    }

    this.applicationName = this.getResponseProperty("applicationName");
    this.passwordCount = this.getResponseProperty("passwordCount");
    this.atRiskPasswordCount = this.getResponseProperty("atRiskPasswordCount");
    this.memberRefs = this.getResponseProperty("memberRefs") ?? {};
    this.cipherRefs = this.getResponseProperty("cipherRefs") ?? {};
    this.memberCount = this.getResponseProperty("memberCount");
    this.atRiskMemberCount = this.getResponseProperty("atRiskMemberCount");
  }
}
