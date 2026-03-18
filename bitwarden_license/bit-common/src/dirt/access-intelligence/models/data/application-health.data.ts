import { ApplicationHealthApi } from "../api/application-health.api";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ApplicationHealth } from "../domain/application-health";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ApplicationHealthView } from "../view/application-health.view";

/**
 * Serializable data model for generated report in access report
 *
 * Uses the member registry pattern with memberRefs and cipherRefs Records instead of
 * duplicated member/cipher arrays.
 *
 * - See {@link ApplicationHealth} for domain model
 * - See {@link ApplicationHealthApi} for API model
 * - See {@link ApplicationHealthView} from View Model
 */
export class ApplicationHealthData {
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

  // TODO: This has been added but we should review if this is how we want to handle the icon metadata
  iconUri?: string;
  iconCipherId?: string;

  constructor(data?: ApplicationHealthApi) {
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
