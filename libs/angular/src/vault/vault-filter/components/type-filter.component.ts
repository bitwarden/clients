// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Directive, EventEmitter, Input, Output } from "@angular/core";

import { CipherType } from "@bitwarden/common/vault/enums";
import { ITreeNodeObject } from "@bitwarden/common/vault/models/domain/tree-node";

import { TopLevelTreeNode } from "../models/top-level-tree-node.model";
import { VaultFilter } from "../models/vault-filter.model";

@Directive()
export class TypeFilterComponent {
  @Input() hide = false;
  @Input() collapsedFilterNodes: Set<string>;
  @Input() selectedCipherType: CipherType = null;
  @Input() activeFilter: VaultFilter;

  @Output() onNodeCollapseStateChange: EventEmitter<ITreeNodeObject> =
    new EventEmitter<ITreeNodeObject>();
  @Output() onFilterChange: EventEmitter<VaultFilter> = new EventEmitter<VaultFilter>();

  readonly typesNode: TopLevelTreeNode = {
    id: "types",
    name: "types",
  };

  cipherTypeEnum = CipherType; // used in the template

  get isCollapsed() {
    return this.collapsedFilterNodes.has(this.typesNode.id);
  }

  applyFilter(cipherType: CipherType) {
    this.activeFilter.resetFilter();
    this.activeFilter.cipherType = cipherType;
    this.onFilterChange.emit(this.activeFilter);
  }

  async toggleCollapse() {
    this.onNodeCollapseStateChange.emit(this.typesNode);
  }
}
