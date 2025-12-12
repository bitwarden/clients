import { Component, input, computed } from "@angular/core";

import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { VaultFilter, CollectionFilter } from "@bitwarden/vault";

import { VAULT_FILTER_IMPORTS } from "../shared-filter-imports";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-collection-filter",
  templateUrl: "collection-filter.component.html",
  standalone: true,
  imports: [...VAULT_FILTER_IMPORTS],
})
export class CollectionFilterComponent {
  protected readonly collection = input<TreeNode<CollectionFilter>>();
  protected readonly activeFilter = input<VaultFilter>();

  protected readonly displayName = computed<string>(() => {
    return this.collection().node.name;
  });

  protected readonly isActive = computed<boolean>(() => {
    return (
      this.collection().node.id === this.activeFilter()?.collectionId &&
      !!this.activeFilter()?.selectedCollectionNode
    );
  });

  protected applyFilter(event: Event) {
    event.stopPropagation();

    const filter = this.activeFilter();

    if (filter) {
      filter.selectedCollectionNode = this.collection();
    }
  }
}
