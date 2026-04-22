import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import Domain from "@bitwarden/common/platform/models/domain/domain-base";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ApplicationHealthApi } from "../api/application-health.api";
import { ApplicationHealthData } from "../data/application-health.data";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ApplicationHealthView } from "../view/application-health.view";

/**
 * Domain model for generated report data in Access Intelligence containing encrypted properties
 *
 * Uses the member registry pattern with memberRefs and cipherRefs Records instead of
 * duplicated member/cipher arrays.
 *
 * - See {@link ApplicationHealthApi} for API model
 * - See {@link ApplicationHealthData} for data model
 * - See {@link ApplicationHealthView} from View Model
 */
export class ApplicationHealth extends Domain {
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

  constructor(obj?: ApplicationHealthData) {
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
  // static fromJSON(): ApplicationHealth {}
  // decrypt(): ApplicationHealthView {}
  // toData(): ApplicationHealthData {}

  // [TODO] SDK Mapping
  // toSdkApplicationHealth(): SdkApplicationHealth {}
  // static fromSdkApplicationHealth(obj?: SdkApplicationHealth): ApplicationHealth | undefined {}
}
