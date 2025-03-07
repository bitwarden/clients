// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Directive, EventEmitter, Input, OnInit, Output } from "@angular/core";

import { CollectionView } from "@bitwarden/admin-console/common";
import { ITreeNodeObject } from "@bitwarden/common/vault/models/domain/tree-node";

import { DynamicTreeNode } from "../models/dynamic-tree-node.model";
import { TopLevelTreeNode } from "../models/top-level-tree-node.model";
import { VaultFilter } from "../models/vault-filter.model";

@Directive()
export class CollectionFilterComponent implements OnInit {
  @Input() hide = false;
  @Input() collapsedFilterNodes: Set<string>;
  @Input() collectionNodes: DynamicTreeNode<CollectionView>;
  @Input() activeFilter: VaultFilter;

  @Output() onNodeCollapseStateChange: EventEmitter<ITreeNodeObject> =
    new EventEmitter<ITreeNodeObject>();
  @Output() onFilterChange: EventEmitter<VaultFilter> = new EventEmitter<VaultFilter>();

  readonly collectionsGrouping: TopLevelTreeNode = {
    id: "collections",
    name: "collections",
  };

  get collections() {
    return this.collectionNodes?.fullList;
  }

  get nestedCollections() {
    return this.collectionNodes?.nestedList;
  }

  get show() {
    return !this.hide && this.collections != null && this.collections.length > 0;
  }

  isCollapsed(node: ITreeNodeObject) {
    return this.collapsedFilterNodes.has(node.id);
  }

  applyFilter(collection: CollectionView) {
    this.activeFilter.resetFilter();
    this.activeFilter.selectedCollection = true;
    this.activeFilter.selectedCollectionId = collection.id;
    this.onFilterChange.emit(this.activeFilter);
  }

  async toggleCollapse(node: ITreeNodeObject) {
    this.onNodeCollapseStateChange.emit(node);
  }

  ngOnInit() {
    // Populate the set with all node IDs so all nodes are collapsed initially.
    if (this.collectionNodes?.fullList) {
      this.collectionNodes.fullList.forEach((node) => {
        this.collapsedFilterNodes.add(node.id);
      });
    }
  }
}
