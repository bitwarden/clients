export const AstNodeTypeNames = [
  "search",
  "not",
  "parentheses",
  "and",
  "or",
  "term",
  "field term",
  "hasAttachment",
  "hasUri",
  "hasFolder",
  "hasCollection",
  "inFolder",
  "inCollection",
  "inOrg",
  "isFavorite",
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
  | IsFavorite;

type AstNodeBase = {
  type: AstNodeType;
  start: number;
  end: number;
  length: number;
};
export type Search = AstNodeBase & {
  type: "search";
  d: Or;
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
  inner: Or;
};

export function isParentheses(x: AstNode): x is Parentheses {
  return x.type === "parentheses";
}

export type And = AstNodeBase & {
  type: "and";
  left: And | Parentheses;
  right: Parentheses;
};

export function isAnd(x: AstNode): x is And {
  return x.type === "and";
}

export type Or = AstNodeBase & {
  type: "or";
  left: Or | And;
  right: And;
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
  type: "field term";
  field: string;
  term: string;
};

export function isFieldTerm(x: AstNode): x is FieldTerm {
  return x.type === "field term";
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

export type IsFavorite = AstNodeBase & {
  type: "isFavorite";
};

export function isIsFavorite(x: AstNode): x is IsFavorite {
  return x.type === "isFavorite";
}
