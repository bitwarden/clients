import Domain from "@bitwarden/common/platform/models/domain/domain-base";
import { EncString } from "@bitwarden/sdk-internal";

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
  applicationName: EncString = "" as EncString;
  passwordCount: EncString = "" as EncString;
  atRiskPasswordCount: EncString = "" as EncString;

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

  memberCount: EncString = "" as EncString;
  atRiskMemberCount: EncString = "" as EncString;

  constructor(obj?: ApplicationHealthData) {
    super();
    if (obj == null) {
      return;
    }
    this.applicationName = obj.applicationName as EncString;
    // FIXME: the *Count fields are declared EncString but ApplicationHealthData holds
    // numbers. The double cast preserves the pre-existing runtime behaviour.
    this.passwordCount = obj.passwordCount as unknown as EncString;
    this.atRiskPasswordCount = obj.atRiskPasswordCount as unknown as EncString;
    this.memberRefs = obj.memberRefs ?? {};
    this.cipherRefs = obj.cipherRefs ?? {};
    this.memberCount = obj.memberCount as unknown as EncString;
    this.atRiskMemberCount = obj.atRiskMemberCount as unknown as EncString;
  }

  // [TODO] Domain level methods
  // static fromJSON(): ApplicationHealth {}
  // decrypt(): ApplicationHealthView {}
  // toData(): ApplicationHealthData {}

  // [TODO] SDK Mapping
  // toSdkApplicationHealth(): SdkApplicationHealth {}
  // static fromSdkApplicationHealth(obj?: SdkApplicationHealth): ApplicationHealth | undefined {}
}
