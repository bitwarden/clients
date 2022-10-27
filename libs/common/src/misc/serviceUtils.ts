import { ITreeNodeObject, TreeNode } from "../models/domain/tree-node";

export class ServiceUtils {
  /**
   * Recursively adds a node to nodeTree
   * @param {TreeNode<ITreeNodeObject>[]} nodeTree - An array of TreeNodes that the node will be added to
   * @param {number} partIndex - Index of the `parts` array that is being processed
   * @param {string[]} parts - Array of strings that represent the path to the `obj` node
   * @param {ITreeNodeObject} obj - The node to be added to the tree
   * @param {ITreeNodeObject} parent - The parent node of the `obj` node
   * @param {string} delimiter - The delimiter used to split the path string
   */
  static nestedTraverse(
    nodeTree: TreeNode<ITreeNodeObject>[],
    partIndex: number,
    parts: string[],
    obj: ITreeNodeObject,
    parent: ITreeNodeObject,
    delimiter: string
  ) {
    if (parts.length <= partIndex) {
      return;
    }

    const end = partIndex === parts.length - 1;
    const partName = parts[partIndex];

    for (let i = 0; i < nodeTree.length; i++) {
      if (nodeTree[i].node.name !== parts[partIndex]) {
        continue;
      }
      if (end && nodeTree[i].node.id !== obj.id) {
        // Another node with the same name.
        nodeTree.push(new TreeNode(obj, parent, partName));
        return;
      }
      ServiceUtils.nestedTraverse(
        nodeTree[i].children,
        partIndex + 1,
        parts,
        obj,
        nodeTree[i].node,
        delimiter
      );
      return;
    }

    if (nodeTree.filter((n) => n.node.name === partName).length === 0) {
      if (end) {
        nodeTree.push(new TreeNode(obj, parent, partName));
        return;
      }
      const newPartName = parts[partIndex] + delimiter + parts[partIndex + 1];
      ServiceUtils.nestedTraverse(
        nodeTree,
        0,
        [newPartName, ...parts.slice(partIndex + 2)],
        obj,
        parent,
        delimiter
      );
    }
  }

  /**
   * Searches a tree for a node with a matching `id`
   * @param {TreeNode<ITreeNodeObject>} nodeTree - A single TreeNode branch that will be searched
   * @param {string} id - The id of the node to be found
   * @returns {TreeNode<ITreeNodeObject>} The node with a matching `id`
   */
  static getTreeNodeObject(
    nodeTree: TreeNode<ITreeNodeObject>,
    id: string
  ): TreeNode<ITreeNodeObject> {
    if (nodeTree.node.id === id) {
      return nodeTree;
    }
    for (let i = 0; i < nodeTree.children.length; i++) {
      if (nodeTree.children[i].children != null) {
        const node = ServiceUtils.getTreeNodeObject(nodeTree.children[i], id);
        if (node !== null) {
          return node;
        }
      }
    }
    return null;
  }

  /**
   * Searches an array of tree nodes for a node with a matching `id`
   * @param {TreeNode<ITreeNodeObject>} nodeTree - An array of TreeNode branches that will be searched
   * @param {string} id - The id of the node to be found
   * @returns {TreeNode<ITreeNodeObject>} The node with a matching `id`
   */
  static getTreeNodeObjectFromList(
    nodeTree: TreeNode<ITreeNodeObject>[],
    id: string
  ): TreeNode<ITreeNodeObject> {
    for (let i = 0; i < nodeTree.length; i++) {
      if (nodeTree[i].node.id === id) {
        return nodeTree[i];
      } else if (nodeTree[i].children != null) {
        const node = ServiceUtils.getTreeNodeObjectFromList(nodeTree[i].children, id);
        if (node !== null) {
          return node;
        }
      }
    }
    return null;
  }
}
