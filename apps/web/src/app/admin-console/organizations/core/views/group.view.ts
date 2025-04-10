// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { View } from "@bitwarden/common/models/view/view";

import { GroupResponse } from "../services/group/responses/group.response";

export class GroupView implements View {
  id: string;
  organizationId: string;
  name: string;
  externalId: string;

  static fromResponse(response: GroupResponse): GroupView {
    return Object.assign(new GroupView(), response);
  }
}
