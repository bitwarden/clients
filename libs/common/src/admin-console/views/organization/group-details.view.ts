// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CollectionAccessSelectionView } from "@bitwarden/common/admin-console/models/collections";
import { GroupDetailsResponse } from "@bitwarden/common/admin-console/services/organization/responses/group.response";
import { View } from "@bitwarden/common/models/view/view";

export class GroupDetailsView implements View {
  id: string;
  organizationId: string;
  name: string;
  externalId: string;
  collections: CollectionAccessSelectionView[] = [];

  static fromResponse(response: GroupDetailsResponse): GroupDetailsView {
    const view: GroupDetailsView = Object.assign(new GroupDetailsView(), response);

    view.collections = response.collections.map((c) => new CollectionAccessSelectionView(c));

    return view;
  }
}
