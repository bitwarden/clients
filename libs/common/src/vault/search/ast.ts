export const AstNodeTypeNames = [
  "search",
  "not",
  "parentheses",
  "and",
  "or",
  "term",
  "fieldTerm",
  "hasAttachment",
  "hasUri",
  "hasFolder",
  "hasCollection",
  "inFolder",
  "inCollection",
  "inOrg",
  "inMyVault",
  "inTrash",
  "isFavorite",
  "type",
  "website",
  "websiteMatch",
  "orderBy",
] as const;
export type AstNodeType = (typeof AstNodeTypeNames)[number];
export type AstNode =
  | Search
  | Not
  | Parentheses
  | And
  | Or
  | Term
  | FieldTerm
  | HasAttachment
  | HasUri
  | HasFolder
  | HasCollection
  | InFolder
  | InCollection
  | InOrg
  | InMyVault
  | InTrash
  | IsFavorite
  | TypeFilter
  | WebsiteFilter
  | WebsiteMatchFilter
  | OrderBy;

export type AstNodeBase = {
  d: object[];
  type: AstNodeType;
  start: number;
  end: number;
  length: number;
};
export type Search = AstNodeBase & {
  type: "search";
  contents: AstNode;
};

export function isSearch(x: AstNode): x is Search {
  return x.type === "search";
}

export type Not = AstNodeBase & {
  type: "not";
  value: Parentheses;
};

export function isNot(x: AstNode): x is Not {
  return x.type === "not";
}

export type Parentheses = AstNodeBase & {
  type: "parentheses";
  inner: AstNode;
};

export function isParentheses(x: AstNode): x is Parentheses {
  return x.type === "parentheses";
}

export type And = AstNodeBase & {
  type: "and";
  left: AstNode;
  right: AstNode;
};

export function isAnd(x: AstNode): x is And {
  return x.type === "and";
}

export type Or = AstNodeBase & {
  type: "or";
  left: AstNode;
  right: AstNode;
};

export function isOr(x: AstNode): x is Or {
  return x.type === "or";
}

export type Term = AstNodeBase & {
  type: "term";
  value: string;
};

export function isTerm(x: AstNode): x is Term {
  return x.type === "term";
}

export type FieldTerm = AstNodeBase & {
  type: "fieldTerm";
  field: string;
  term: string;
};

export function isFieldTerm(x: AstNode): x is FieldTerm {
  return x.type === "fieldTerm";
}

export type HasAttachment = AstNodeBase & {
  type: "hasAttachment";
};

export function isHasAttachment(x: AstNode): x is HasAttachment {
  return x.type === "hasAttachment";
}

export type HasUri = AstNodeBase & {
  type: "hasUri";
};

export function isHasUri(x: AstNode): x is HasUri {
  return x.type === "hasUri";
}

export type HasFolder = AstNodeBase & {
  type: "hasFolder";
};

export function isHasFolder(x: AstNode): x is HasFolder {
  return x.type === "hasFolder";
}

export type HasCollection = AstNodeBase & {
  type: "hasCollection";
};

export function isHasCollection(x: AstNode): x is HasCollection {
  return x.type === "hasCollection";
}

export type InFolder = AstNodeBase & {
  type: "inFolder";
  folder: string;
};

export function isInFolder(x: AstNode): x is InFolder {
  return x.type === "inFolder";
}

export type InCollection = AstNodeBase & {
  type: "inCollection";
  collection: string;
};

export function isInCollection(x: AstNode): x is InCollection {
  return x.type === "inCollection";
}

export type InOrg = AstNodeBase & {
  type: "inOrg";
  org: string;
};

export function isInOrg(x: AstNode): x is InOrg {
  return x.type === "inOrg";
}

export type InMyVault = AstNodeBase & {
  type: "inMyVault";
};

export function isInMyVault(x: AstNode): x is InMyVault {
  return x.type === "inMyVault";
}

export type InTrash = AstNodeBase & {
  type: "inTrash";
};

export function isInTrash(x: AstNode): x is InTrash {
  return x.type === "inTrash";
}

export type IsFavorite = AstNodeBase & {
  type: "isFavorite";
};

export function isIsFavorite(x: AstNode): x is IsFavorite {
  return x.type === "isFavorite";
}

export type TypeFilter = AstNodeBase & {
  type: "type";
  cipherType: string;
};

export function isTypeFilter(x: AstNode): x is TypeFilter {
  return x.type === "type";
}

export type WebsiteFilter = AstNodeBase & {
  type: "website";
  website: string;
};

export function isWebsiteFilter(x: AstNode): x is WebsiteFilter {
  return x.type === "website";
}

export type WebsiteMatchFilter = AstNodeBase & {
  type: "websiteMatch";
  website: string;
  matchType: string;
};

export function isWebsiteMatchFilter(x: AstNode): x is WebsiteMatchFilter {
  return x.type === "websiteMatch";
}

export enum OrderDirection {
  Asc = "asc",
  Desc = "desc",
}

export type OrderBy = AstNodeBase & {
  type: "orderBy";
  field: string;
  direction: OrderDirection;
};

export function isOrderBy(x: AstNode): x is OrderBy {
  return x.type === "orderBy";
}
