import { Jsonify } from "type-fest";

import { View } from "@bitwarden/common/models/view/view";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { MemberDetailsApi } from "../api/member-details.api";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { MemberDetailsData } from "../data/member-details.data";
import { MemberDetails } from "../domain/member-details";

/**
 * View model for Member Details in Risk Insights containing decrypted properties
 *
 * - See {@link MemberDetails} for domain model
 * - See {@link MemberDetailsData} for data model
 * - See {@link MemberDetailsApi} for API model
 */
export class MemberDetailsView implements View {
  userGuid: string = "";
  userName: string = "";
  email: string = "";
  cipherId: string = "";

  constructor(m?: MemberDetails) {
    if (m == null) {
      return;
    }
  }

  toJSON() {
    return this;
  }

  static fromJSON(
    obj: Partial<Jsonify<MemberDetailsView>> | undefined,
  ): MemberDetailsView | undefined {
    return Object.assign(new MemberDetailsView(), obj);
  }

  // [TODO] SDK Mapping
  // toSdkMemberDetailsView(): SdkMemberDetailsView {}
  // static fromMemberDetailsView(obj?: SdkMemberDetailsView): MemberDetailsView | undefined {}
}
