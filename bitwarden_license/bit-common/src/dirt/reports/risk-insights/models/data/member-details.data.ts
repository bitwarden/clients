import { MemberDetailsApi } from "../api/member-details.api";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { MemberDetails } from "../domain/member-details";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { MemberDetailsView } from "../view/member-details.view";

/**
 * Serializable data model for member details in risk insights report
 *
 * - See {@link MemberDetails} for domain model
 * - See {@link MemberDetailsApi} for API model
 * - See {@link MemberDetailsView} from View Model
 */
export class MemberDetailsData {
  userGuid: string;
  userName: string;
  email: string;
  cipherId: string;

  constructor(data?: MemberDetailsApi) {
    if (data == null) {
      return;
    }

    this.userGuid = data.userGuid;
    this.userName = data.userName;
    this.email = data.email;
    this.cipherId = data.cipherId;
  }
}
