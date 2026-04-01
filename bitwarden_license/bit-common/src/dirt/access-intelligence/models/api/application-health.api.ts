import { BaseResponse } from "@bitwarden/common/models/response/base.response";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ApplicationHealthData } from "../data/application-health.data";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ApplicationHealth } from "../domain/application-health";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ApplicationHealthView } from "../view/application-health.view";

/**
 * Converts an ApplicationHealth API response
 *
 * Uses the member registry pattern with memberRefs and cipherRefs Records instead of
 * duplicated member/cipher arrays.
 *
 * - See {@link ApplicationHealth} for domain model
 * - See {@link ApplicationHealthData} for data model
 * - See {@link ApplicationHealthView} from View Model
 */
export class ApplicationHealthApi extends BaseResponse {
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
