import lunr from "lunr";

import { CollectionView } from "@bitwarden/admin-console/common";

import { Organization } from "../../admin-console/models/domain/organization";
import { CipherView } from "../models/view/cipher.view";
import { FolderView } from "../models/view/folder.view";

import { AstNodeType } from "./ast";

export type ProcessInstructions = {
  filter: (context: SearchContext) => SearchContext;
  sections: { start: number; end: number; type: AstNodeType }[];
};

export type SearchContext = {
  ciphers: CipherView[];
  folders: FolderView[];
  collections: CollectionView[];
  organizations: Organization[];
  index: lunr.Index;
};
