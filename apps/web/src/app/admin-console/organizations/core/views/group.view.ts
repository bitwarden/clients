import { View } from "@bitwarden/common/models/view/view";

import { GroupResponse } from "../services/group/responses/group.response";

export class GroupView implements View {
  readonly id: string;
  readonly organizationId: string;
  readonly name: string;
  readonly externalId: string | undefined;

  constructor(c: { id: string; organizationId: string; name: string; externalId?: string }) {
    this.id = c.id;
    this.organizationId = c.organizationId;
    this.name = c.name;
    this.externalId = c.externalId ?? undefined;
  }

  static fromResponse(response: GroupResponse): GroupView {
    return new GroupView({
      id: response.id,
      organizationId: response.organizationId,
      name: response.name,
      externalId: response.externalId ?? undefined,
    });
  }
}
