import { Parser, Grammar } from "nearley";

import { Utils } from "../../platform/misc/utils";
import { CardLinkedId, FieldType, LinkedIdType, LoginLinkedId } from "../enums";
import { CipherView } from "../models/view/cipher.view";

import {
  AstNode,
  isAnd,
  isFieldTerm,
  isHasAttachment,
  isHasFolder,
  isHasUri,
  isInCollection,
  isInFolder,
  isInOrg,
  isIsFavorite,
  isNot,
  isOr,
  isParentheses,
  isSearch,
  isTerm,
} from "./ast";
import grammar from "./bitwarden-query-grammar";
import { ProcessInstructions } from "./query.types";

export const PARSE_ERROR = new Error("Invalid search query");

export function parseQuery(query: string): ProcessInstructions {
  const parser = new Parser(Grammar.fromCompiled(grammar));
  parser.feed(query);
  if (!parser.results) {
    // TODO: Better error handling
    // there should be some invalid token information
    throw PARSE_ERROR;
  }

  const result = parser.results[0] as AstNode;

  const parsed = handleNode(result);
  return parsed;
}

function handleNode(node: AstNode): ProcessInstructions {
  if (isSearch(node)) {
    return handleNode(node.contents);
  } else if (isOr(node)) {
    const left = handleNode(node.left);
    const right = handleNode(node.right);
    return {
      filter: (context) => {
        const leftFilteredContext = left.filter(context);
        const rightFilteredContext = right.filter(context);
        return {
          ...context,
          ciphers: leftFilteredContext.ciphers.concat(rightFilteredContext.ciphers),
        };
      },
      sections: left.sections.concat(right.sections).concat([
        {
          start: node.start,
          end: node.end,
          type: node.type,
        },
      ]),
    };
  } else if (isNot(node)) {
    const negate = handleNode(node.value);
    return {
      filter: (context) => {
        const filteredContext = negate.filter(context);
        return {
          ...context,
          ciphers: context.ciphers.filter((cipher) => !filteredContext.ciphers.includes(cipher)),
        };
      },
      sections: negate.sections.concat([
        {
          start: node.start,
          end: node.end,
          type: node.type,
        },
      ]),
    };
  } else if (isAnd(node)) {
    const left = handleNode(node.left);
    const right = handleNode(node.right);
    return {
      filter: (context) => {
        const leftFilteredContext = left.filter(context);
        return right.filter(leftFilteredContext);
      },
      sections: left.sections.concat(right.sections).concat([
        {
          start: node.start,
          end: node.end,
          type: node.type,
        },
      ]),
    };
  } else if (isParentheses(node)) {
    const inner = handleNode(node.inner);
    return {
      filter: inner.filter,
      sections: inner.sections.concat([
        {
          start: node.start,
          end: node.end,
          type: node.type,
        },
      ]),
    };
  } else if (isTerm(node)) {
    // search all fields for term at node value
    const termTest = termToRegexTest(node.value);
    return {
      filter: (context) => {
        const ciphers = context.ciphers.filter((cipher) => hasTerm(cipher, termTest));
        return {
          ...context,
          ciphers,
        };
      },
      sections: [
        {
          start: node.start,
          end: node.end,
          type: node.type,
        },
      ],
    };
  } else if (isFieldTerm(node)) {
    const fieldTest = fieldNameToRegexTest(node.field);
    const termTest = termToRegexTest(node.term);
    return {
      filter: (context) => {
        const ciphers = context.ciphers.filter((cipher) => hasTerm(cipher, termTest, fieldTest));
        return {
          ...context,
          ciphers,
        };
      },
      sections: [
        {
          start: node.start,
          end: node.end,
          type: node.type,
        },
      ],
    };
  } else if (isHasAttachment(node)) {
    return {
      filter: (context) => ({
        ...context,
        ciphers: context.ciphers.filter(
          (cipher) => !!cipher.attachments && cipher.attachments.length > 0,
        ),
      }),
      sections: [
        {
          start: node.start,
          end: node.end,
          type: node.type,
        },
      ],
    };
  } else if (isHasUri(node)) {
    return {
      filter: (context) => ({
        ...context,
        ciphers: context.ciphers.filter(
          (cipher) => !!cipher?.login?.uris && cipher.login.uris.length > 0,
        ),
      }),
      sections: [
        {
          start: node.start,
          end: node.end,
          type: node.type,
        },
      ],
    };
  } else if (isHasFolder(node)) {
    return {
      filter: (context) => ({
        ...context,
        ciphers: context.ciphers.filter((cipher) => !!cipher.folderId),
      }),
      sections: [
        {
          start: node.start,
          end: node.end,
          type: node.type,
        },
      ],
    };
  } else if (isInFolder(node)) {
    // TODO: There is currently no folder name information in a cipher view
    return {
      filter: (context) => {
        const folderId = context.folders.find((folder) => folder.name === node.folder)?.id;
        return {
          ...context,
          ciphers:
            folderId == null
              ? // Folder not found, no matches
                // TODO: should this be an error?
                []
              : context.ciphers.filter((cipher) => cipher.folderId === folderId),
        };
      },
      sections: [
        {
          start: node.start,
          end: node.end,
          type: node.type,
        },
      ],
    };
  } else if (isInCollection(node)) {
    // TODO: There is currently no collection name information in a cipher view
    return {
      filter: (context) => {
        const collectionId = context.collections.find(
          (collection) => collection.name === node.collection,
        )?.id;
        return {
          ...context,
          ciphers:
            collectionId == null
              ? // Collection not found, no matches
                // TODO: should this be an error?
                []
              : context.ciphers.filter((cipher) => cipher.collectionIds.includes(collectionId)),
        };
      },
      sections: [
        {
          start: node.start,
          end: node.end,
          type: node.type,
        },
      ],
    };
  } else if (isInOrg(node)) {
    // TODO: There is currently no organization name information in a cipher view
    return {
      filter: (context) => {
        const organizationId = context.organizations.find((org) => org.name === node.org)?.id;
        return {
          ...context,
          ciphers:
            organizationId == null
              ? // Organization not found, no matches
                // TODO: This should be an error
                []
              : context.ciphers.filter((cipher) => cipher.organizationId === organizationId),
        };
      },
      sections: [
        {
          start: node.start,
          end: node.end,
          type: node.type,
        },
      ],
    };
  } else if (isIsFavorite(node)) {
    return {
      filter: (context) => ({
        ...context,
        ciphers: context.ciphers.filter((cipher) => cipher.favorite),
      }),
      sections: [
        {
          start: node.start,
          end: node.end,
          type: node.type,
        },
      ],
    };
  } else {
    throw new Error("Invalid node\n" + JSON.stringify(node, null, 2));
  }
}

function hasTerm(cipher: CipherView, termTest: RegExp, fieldTest: RegExp = /.*/i): boolean {
  const foundValues = fieldValues(cipher, fieldTest);

  return foundValues.some((foundValue) => termTest.test(foundValue.value));
}

function termToRegexTest(term: string) {
  if (term.startsWith('"') && term.endsWith('"')) {
    // quoted term, we're looking for an exact match up to whitespace
    const coercedTerm = term.slice(1, term.length - 1);
    return RegExp(`(^|\\s)${Utils.escapeRegex(coercedTerm)}($|\\s)`, "i");
  } else {
    // non-quoted term, matching partials
    return RegExp(`.*${Utils.escapeRegex(term)}.*`, "i");
  }
}

function fieldNameToRegexTest(field: string) {
  if (field.startsWith('"') && field.endsWith('"')) {
    // quoted field name, this needs to match the full field name
    const coercedField = field.slice(1, field.length - 1);
    return RegExp(`^${Utils.escapeRegex(coercedField)}$`, "i");
  } else {
    // non-quoted field name, we don't need to coerce, but we still expect a complete match
    return RegExp(`^${Utils.escapeRegex(field)}$`, "i");
  }
}

const ForbiddenFields = Object.freeze(["login.password", "login.totp"]);

const ForbiddenLinkedIds: Readonly<LinkedIdType[]> = Object.freeze([
  LoginLinkedId.Password,
  CardLinkedId.Number,
  CardLinkedId.Code,
]);

type FieldValues = { path: string; value: string }[];
function fieldValues(cipher: CipherView, fieldTest: RegExp): FieldValues {
  const result = recursiveValues(cipher, fieldTest, "");

  // append custom fields
  for (const field of cipher.fields ?? []) {
    switch (field.type) {
      case FieldType.Text:
        if (fieldTest.test(field.name)) {
          result.push({
            path: `customField.${field.name}`,
            value: field.value,
          });
        }
        break;
      case FieldType.Linked: {
        if (ForbiddenLinkedIds.includes(field.linkedId)) {
          break;
        }

        const value = cipher.linkedFieldValue(field.linkedId);
        if (typeof value !== "string") {
          break;
        }
        if (fieldTest.test(field.name) && value != null) {
          result.push({
            path: `customField.${field.name}`,
            value: value,
          });
        }
        break;
      }
      default:
        break;
    }
  }

  // append attachments
  if (fieldTest.test("fileName")) {
    cipher.attachments?.forEach((a) => {
      result.push({
        path: `attachment.fileName`,
        value: a.fileName,
      });
    });
  }

  // Purge forbidden paths from results
  return result.filter(({ path }) => {
    return !ForbiddenFields.includes(path);
  });
}

function recursiveValues<T extends object>(obj: T, fieldTest: RegExp, crumb: string): FieldValues {
  const result: FieldValues = [];

  if (obj == null || typeof obj !== "object" || Array.isArray(obj) || typeof obj === "function") {
    // only process objects
    return result;
  }

  const keys = Reflect.ownKeys(obj).filter((key) => typeof key === "string") as (keyof T &
    string)[];

  for (const key of keys) {
    const value = obj[key];
    const path = crumb.length == 0 ? key : `${crumb}.${key}`;

    if (typeof value === "string" && fieldTest.test(key)) {
      result.push({
        path,
        value,
      });
    }

    if (typeof value === "object") {
      // continue search downward
      const inner = recursiveValues(value as object, fieldTest, path);
      result.concat(inner);
    }
  }

  return result;
}

export function deepFreeze<T extends object>(value: T): Readonly<T> {
  const keys = Reflect.ownKeys(value) as (keyof T)[];

  for (const key of keys) {
    const own = value[key];

    if ((own && typeof own === "object") || typeof own === "function") {
      deepFreeze(own);
    }
  }

  return Object.freeze(value);
}
