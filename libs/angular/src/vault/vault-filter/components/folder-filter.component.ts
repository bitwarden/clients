// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Directive, EventEmitter, Input, Output } from "@angular/core";

import { ITreeNodeObject } from "@bitwarden/common/vault/models/domain/tree-node";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";

import { DynamicTreeNode } from "../models/dynamic-tree-node.model";
import { TopLevelTreeNode } from "../models/top-level-tree-node.model";
import { VaultFilter } from "../models/vault-filter.model";

@Directive()
export class FolderFilterComponent {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() hide = false;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() collapsedFilterNodes: Set<string>;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() folderNodes: DynamicTreeNode<FolderView>;
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
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() onAddFolder = new EventEmitter();
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() onEditFolder = new EventEmitter<FolderView>();

  get folders() {
    return this.folderNodes?.fullList;
  }

  get nestedFolders() {
    return this.folderNodes?.nestedList;
  }

  readonly foldersGrouping: TopLevelTreeNode = {
    id: "folders",
    name: "folders",
  };

  applyFilter(folder: FolderView) {
    this.activeFilter.resetFilter();
    this.activeFilter.selectedFolder = true;
    this.activeFilter.selectedFolderId = folder.id;
    this.onFilterChange.emit(this.activeFilter);
  }

  addFolder() {
    this.onAddFolder.emit();
  }

  editFolder(folder: FolderView) {
    this.onEditFolder.emit(folder);
  }

  isCollapsed(node: ITreeNodeObject) {
    return this.collapsedFilterNodes.has(node.id);
  }

  async toggleCollapse(node: ITreeNodeObject) {
    this.onNodeCollapseStateChange.emit(node);
  }
}
