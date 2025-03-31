// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ITreeNodeObject, TreeNode } from "./models/domain/tree-node";

export class ServiceUtils {
  /**
   * Recursively adds a node to nodeTree
   * @param {TreeNode<ITreeNodeObject>[]} nodeTree - An array of TreeNodes that the node will be added to
   * @param {number} partIndex - Index of the `parts` array that is being processed
   * @param {string[]} parts - Array of strings that represent the path to the `obj` node
   * @param {ITreeNodeObject} obj - The node to be added to the tree
   * @param {ITreeNodeObject} parent - The parent node of the `obj` node
   * @param {string} delimiter - The delimiter used to split the path string, will be used to combine the path for missing nodes
   */
  static nestedTraverse(
    nodeTree: TreeNode<ITreeNodeObject>[],
    partIndex: number,
    parts: string[],
    obj: ITreeNodeObject,
    parent: TreeNode<ITreeNodeObject> | undefined,
    delimiter: string,
  ) {
    if (parts.length <= partIndex) {
      return;
    }

    const end: boolean = partIndex === parts.length - 1;
    const partName: string = parts[partIndex];

    for (let i = 0; i < nodeTree.length; i++) {
      if (nodeTree[i].node.name !== partName) {
        continue;
      }
      if (end && nodeTree[i].node.id !== obj.id) {
        // Another node exists with the same name as the node being added
        nodeTree.push(new TreeNode(obj, parent, partName));
        return;
      }
      // Move down the tree to the next level
      ServiceUtils.nestedTraverse(
        nodeTree[i].children,
        partIndex + 1,
        parts,
        obj,
        nodeTree[i],
        delimiter,
      );
      return;
    }

    // If there's no node here with the same name...
    if (nodeTree.filter((n) => n.node.name === partName).length === 0) {
      // And we're at the end of the path given, add the node
      if (end) {
        nodeTree.push(new TreeNode(obj, parent, partName));
        return;
      }
      // And we're not at the end of the path, combine the current name with the next name
      // 1, *1.2, 1.2.1 becomes
      // 1, *1.2/1.2.1
      const newPartName = partName + delimiter + parts[partIndex + 1];
      ServiceUtils.nestedTraverse(
        nodeTree,
        0,
        [newPartName, ...parts.slice(partIndex + 2)],
        obj,
        parent,
        delimiter,
      );
    }
  }

  /**
   * Searches a tree for a node with a matching `id`
   * @param {TreeNode<T>} nodeTree - A single TreeNode branch that will be searched
   * @param {string} id - The id of the node to be found
   * @returns {TreeNode<T>} The node with a matching `id`
   */
  static getTreeNodeObject<T extends ITreeNodeObject>(
    nodeTree: TreeNode<T>,
    id: string,
  ): TreeNode<T> {
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
   * @param {TreeNode<T>} nodeTree - An array of TreeNode branches that will be searched
   * @param {string} id - The id of the node to be found
   * @returns {TreeNode<T>} The node with a matching `id`
   */
  static getTreeNodeObjectFromList<T extends ITreeNodeObject>(
    nodeTree: TreeNode<T>[],
    id: string,
  ): TreeNode<T> {
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
