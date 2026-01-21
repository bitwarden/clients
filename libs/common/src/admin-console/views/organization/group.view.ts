// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { GroupResponse } from "@bitwarden/common/admin-console/services/organization/responses/group.response";
import { View } from "@bitwarden/common/models/view/view";

export class GroupView implements View {
  id: string;
  organizationId: string;
  name: string;
  externalId: string;

  static fromResponse(response: GroupResponse): GroupView {
    return Object.assign(new GroupView(), response);
  }
}
