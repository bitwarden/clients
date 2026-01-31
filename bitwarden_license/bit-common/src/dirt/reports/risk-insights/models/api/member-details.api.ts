import { BaseResponse } from "@bitwarden/common/models/response/base.response";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { MemberDetailsData } from "../data/member-details.data";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { MemberDetails } from "../domain/member-details";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { MemberDetailsView } from "../view/member-details.view";

/**
 * Converts a MemberDetails API response
 *
 * - See {@link MemberDetails} for domain model
 * - See {@link MemberDetailsData} for data model
 * - See {@link MemberDetailsView} from View Model
 */
export class MemberDetailsApi extends BaseResponse {
  userGuid: string;
  userName: string;
  email: string;
  cipherId: string;

  constructor(data: any = null) {
    super(data);
    if (data == null) {
      return;
    }
    this.userGuid = this.getResponseProperty("userGuid");
    this.userName = this.getResponseProperty("userName");
    this.email = this.getResponseProperty("email");
    this.cipherId = this.getResponseProperty("cipherId");
  }
}
