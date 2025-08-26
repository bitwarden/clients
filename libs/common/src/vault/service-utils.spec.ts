import { ITreeNodeObject, TreeNode } from "./models/domain/tree-node";
import { ServiceUtils } from "./service-utils";

type FakeObject = { id: string; name: string };

describe("serviceUtils", () => {
  let nodeTree: TreeNode<FakeObject>[];
  beforeEach(() => {
    nodeTree = [
      createTreeNode({ id: "1", name: "1" }, [
        createTreeNode({ id: "1.1", name: "1.1" }, [
          createTreeNode({ id: "1.1.1", name: "1.1.1" }),
        ]),
        createTreeNode({ id: "1.2", name: "1.2" }),
      ])(null),
      createTreeNode({ id: "2", name: "2" }, [createTreeNode({ id: "2.1", name: "2.1" })])(null),
      createTreeNode({ id: "3", name: "3" }, [])(null),
    ];
  });

  describe("nestedTraverse", () => {
    it("should traverse a tree and add a node at the correct position given a valid path", () => {
      const nodeToBeAdded: FakeObject = { id: "1.2.1", name: "1.2.1" };
      const path = ["1", "1.2", "1.2.1"];

      ServiceUtils.nestedTraverse(nodeTree, 0, path, nodeToBeAdded, null, "/");
      expect(nodeTree[0].children[1].children[0].node).toEqual(nodeToBeAdded);
    });

    it("should combine the path for missing nodes and use as the added node name given an invalid path", () => {
      const nodeToBeAdded: FakeObject = { id: "blank", name: "blank" };
      const path = ["3", "3.1", "3.1.1"];

      ServiceUtils.nestedTraverse(nodeTree, 0, path, nodeToBeAdded, null, "/");
      expect(nodeTree[2].children[0].node.name).toEqual("3.1/3.1.1");
    });
  });

  describe("getTreeNodeObject", () => {
    it("should return a matching node given a single tree branch and a valid id", () => {
      const id = "1.1.1";
      const given = ServiceUtils.getTreeNodeObject(nodeTree[0], id);
      expect(given.node.id).toEqual(id);
    });
  });

  describe("getTreeNodeObjectFromList", () => {
    it("should return a matching node given a list of branches and a valid id", () => {
      const id = "1.1.1";
      const given = ServiceUtils.getTreeNodeObjectFromList(nodeTree, id);
      expect(given.node.id).toEqual(id);
    });
  });
});

type TreeNodeFactory<T extends ITreeNodeObject> = (
  obj: T,
  children?: TreeNodeFactoryWithoutParent<T>[],
) => TreeNodeFactoryWithoutParent<T>;

type TreeNodeFactoryWithoutParent<T extends ITreeNodeObject> = (
  parent?: TreeNode<T>,
) => TreeNode<T>;

const createTreeNode: TreeNodeFactory<FakeObject> =
  (obj, children = []) =>
  (parent) => {
    const node = new TreeNode<FakeObject>(obj, parent, obj.name, obj.id);
    node.children = children.map((childFunc) => childFunc(node));
    return node;
  };
