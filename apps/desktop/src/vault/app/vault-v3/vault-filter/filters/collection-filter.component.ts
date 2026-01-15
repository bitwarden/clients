import { Component, input, computed } from "@angular/core";

import { TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";
import { NavigationModule, A11yTitleDirective } from "@bitwarden/components";
import { VaultFilter, CollectionFilter } from "@bitwarden/vault";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-collection-filter",
  templateUrl: "collection-filter.component.html",
  imports: [A11yTitleDirective, NavigationModule],
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
