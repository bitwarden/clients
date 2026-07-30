// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Directive, EventEmitter, Input, Output } from "@angular/core";

import { CipherType } from "@bitwarden/common/vault/enums";
import { ITreeNodeObject } from "@bitwarden/common/vault/models/domain/tree-node";

import { TopLevelTreeNode } from "../models/top-level-tree-node.model";
import { VaultFilter } from "../models/vault-filter.model";

@Directive()
export class TypeFilterComponent {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() hide = false;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() collapsedFilterNodes: Set<string>;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() selectedCipherType: CipherType = null;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() activeFilter: VaultFilter;

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() onNodeCollapseStateChange: EventEmitter<ITreeNodeObject> =
    new EventEmitter<ITreeNodeObject>();
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
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
