// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ITreeNodeObject } from "@bitwarden/common/vault/models/domain/tree-node";

export type TopLevelTreeNodeId = "vaults" | "types" | "collections" | "folders";
export class TopLevelTreeNode implements ITreeNodeObject {
  id: TopLevelTreeNodeId;
  name: string; // localizationString
}
