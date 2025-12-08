import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import Domain from "@bitwarden/common/platform/models/domain/domain-base";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { MemberDetailsApi } from "../api/member-details.api";
import { MemberDetailsData } from "../data/member-details.data";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { MemberDetailsView } from "../view/member-details.view";

/**
 * Domain model for Member Details in Risk Insights containing encrypted properties
 *
 * - See {@link MemberDetailsApi} for API model
 * - See {@link MemberDetailsData} for data model
 * - See {@link MemberDetailsView} from View Model
 */
export class MemberDetails extends Domain {
  userGuid: EncString = new EncString("");
  userName: EncString = new EncString("");
  email: EncString = new EncString("");
  cipherId: EncString = new EncString("");

  constructor(data?: MemberDetailsData) {
    super();
    if (data == null) {
      return;
    }

    this.userGuid = new EncString(data.userGuid);
    this.userName = new EncString(data.userName);
    this.email = new EncString(data.email);
    this.cipherId = new EncString(data.cipherId);
  }
}
