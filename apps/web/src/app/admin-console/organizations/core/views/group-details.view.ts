import { CollectionAccessSelectionView } from "@bitwarden/common/admin-console/models/collections";
import { View } from "@bitwarden/common/models/view/view";

import { GroupDetailsResponse } from "../services/group/responses/group.response";

export class GroupDetailsView implements View {
  readonly id: string;
  readonly organizationId: string;
  readonly name: string;
  readonly externalId: string | undefined;
  readonly collections: CollectionAccessSelectionView[];

  constructor(c: {
    id: string;
    organizationId: string;
    name: string;
    externalId?: string;
    collections?: CollectionAccessSelectionView[];
  }) {
    this.id = c.id;
    this.organizationId = c.organizationId;
    this.name = c.name;
    this.externalId = c.externalId ?? undefined;
    this.collections = c.collections ?? [];
  }

  static fromResponse(response: GroupDetailsResponse): GroupDetailsView {
    return new GroupDetailsView({
      id: response.id,
      organizationId: response.organizationId,
      name: response.name,
      externalId: response.externalId ?? undefined,
      collections: (response.collections ?? []).map((c) => new CollectionAccessSelectionView(c)),
    });
  }
}
