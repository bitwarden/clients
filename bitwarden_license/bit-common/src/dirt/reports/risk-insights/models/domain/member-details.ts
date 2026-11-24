import Domain from "@bitwarden/common/platform/models/domain/domain-base";
import { EncString } from "@bitwarden/sdk-internal";

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
  userGuid: EncString = "" as EncString;
  userName: EncString = "" as EncString;
  email: EncString = "" as EncString;
  cipherId: EncString = "" as EncString;

  constructor(data?: MemberDetailsData) {
    super();
    if (data == null) {
      return;
    }

    this.userGuid = data.userGuid as EncString;
    this.userName = data.userName as EncString;
    this.email = data.email as EncString;
    this.cipherId = data.cipherId as EncString;
  }
}
