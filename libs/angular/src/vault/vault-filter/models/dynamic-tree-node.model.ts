// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ITreeNodeObject, TreeNode } from "@bitwarden/common/vault/models/domain/tree-node";

export class DynamicTreeNode<T extends ITreeNodeObject> {
  fullList: T[];
  nestedList: TreeNode<T>[];

  hasId(id: string): boolean {
    return this.fullList != null && this.fullList.filter((i: T) => i.id === id).length > 0;
  }

  constructor(init?: Partial<DynamicTreeNode<T>>) {
    Object.assign(this, init);
  }
}
