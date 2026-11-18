import {
  CollectionTypes,
  CollectionView,
} from "@bitwarden/common/admin-console/models/collections";
import { CollectionId, OrganizationId } from "@bitwarden/common/types/guid";

import { PinnedFolderNode, resolvePinnedFolderNodes } from "./pinned-shared-folder-nodes";

const orgId = "org-a" as OrganizationId;
const otherOrgId = "org-b" as OrganizationId;

function collection(
  id: string,
  name: string,
  organizationId: OrganizationId = orgId,
): CollectionView {
  return new CollectionView({ id: id as CollectionId, organizationId, name });
}

type Shape = { id: string; name: string; children: Shape[] };

/** The tree without each node's collection, so a test can compare shape alone. */
const shape = (nodes: PinnedFolderNode[]): Shape[] =>
  nodes.map((node) => ({ id: node.id, name: node.name, children: shape(node.children) }));

const ids = (...values: string[]) => values as CollectionId[];

describe("resolvePinnedFolderNodes", () => {
  it("returns nothing when no folder is pinned", () => {
    const result = resolvePinnedFolderNodes({
      organizationId: orgId,
      collections: [collection("1", "Design")],
      pinnedIds: [],
    });

    expect(result).toEqual([]);
  });

  it("returns pinned folders alphabetically", () => {
    const result = resolvePinnedFolderNodes({
      organizationId: orgId,
      collections: [collection("1", "Zebra"), collection("2", "Apple"), collection("3", "Mango")],
      pinnedIds: ids("1", "2", "3"),
    });

    expect(result.map((node) => node.name)).toEqual(["Apple", "Mango", "Zebra"]);
  });

  it("nests the children and sub-children of a pinned folder", () => {
    const result = resolvePinnedFolderNodes({
      organizationId: orgId,
      collections: [
        collection("1", "Design"),
        collection("2", "Design/Brand"),
        collection("3", "Design/Brand/Logos"),
        collection("4", "Design/Web"),
      ],
      pinnedIds: ids("1"),
    });

    expect(shape(result)).toEqual([
      {
        id: "1",
        name: "Design",
        children: [
          {
            id: "2",
            name: "Brand",
            children: [{ id: "3", name: "Logos", children: [] }],
          },
          { id: "4", name: "Web", children: [] },
        ],
      },
    ]);
  });

  it("shows a pinned child on its own, under its leaf name", () => {
    const result = resolvePinnedFolderNodes({
      organizationId: orgId,
      collections: [collection("1", "Design"), collection("2", "Design/Brand")],
      pinnedIds: ids("2"),
    });

    expect(shape(result)).toEqual([{ id: "2", name: "Brand", children: [] }]);
  });

  it("shows a pinned folder and its pinned child in both places", () => {
    const result = resolvePinnedFolderNodes({
      organizationId: orgId,
      collections: [collection("1", "Design"), collection("2", "Design/Brand")],
      pinnedIds: ids("1", "2"),
    });

    expect(shape(result)).toEqual([
      { id: "2", name: "Brand", children: [] },
      { id: "1", name: "Design", children: [{ id: "2", name: "Brand", children: [] }] },
    ]);
  });

  it("hides pinned ids that no longer resolve", () => {
    const result = resolvePinnedFolderNodes({
      organizationId: orgId,
      collections: [collection("1", "Design")],
      pinnedIds: ids("gone", "1"),
    });

    expect(result.map((node) => node.id)).toEqual(["1"]);
  });

  it("ignores pinned folders of other organizations", () => {
    const result = resolvePinnedFolderNodes({
      organizationId: orgId,
      collections: [collection("1", "Design"), collection("2", "Finance", otherOrgId)],
      pinnedIds: ids("1", "2"),
    });

    expect(result.map((node) => node.id)).toEqual(["1"]);
  });

  it("excludes the default collection", () => {
    const myItems = Object.assign(collection("1", "My items"), {
      type: CollectionTypes.DefaultUserCollection,
    });

    const result = resolvePinnedFolderNodes({
      organizationId: orgId,
      collections: [myItems],
      pinnedIds: ids("1"),
    });

    expect(result).toEqual([]);
  });

  it("does not rename or reorder the collections it is given", () => {
    const collections = [collection("1", "Design"), collection("2", "Design/Brand")].reverse();

    resolvePinnedFolderNodes({ organizationId: orgId, collections, pinnedIds: ids("1") });

    expect(collections.map((c) => c.name)).toEqual(["Design/Brand", "Design"]);
  });
});
