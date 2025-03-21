import { Parser, Grammar } from "nearley";

import { UriMatchStrategy, UriMatchStrategySetting } from "../../models/domain/domain-service";
import { LogService } from "../../platform/abstractions/log.service";
import { Utils } from "../../platform/misc/utils";
import { CipherId } from "../../types/guid";
import { CardLinkedId, CipherType, FieldType, LinkedIdType, LoginLinkedId } from "../enums";
import { CipherView } from "../models/view/cipher.view";

import {
  AstNode,
  OrderDirection,
  Search,
  isAnd,
  isFieldTerm,
  isHasAttachment,
  isHasField,
  isHasFolder,
  isHasUri,
  isInCollection,
  isInFolder,
  isInMyVault,
  isInOrg,
  isInTrash,
  isIsFavorite,
  isNot,
  isOr,
  isOrderBy,
  isParentheses,
  isSearch,
  isTerm,
  isTypeFilter,
  isWebsiteFilter,
  isWebsiteMatchFilter,
} from "./ast";
import grammar from "./bitwarden-query-grammar";
import { ProcessInstructions, SearchContext } from "./query.types";

export const PARSE_ERROR = new Error("Invalid search query");

export function parseQuery(query: string, logService: LogService): ProcessInstructions {
  const parser = new Parser(Grammar.fromCompiled(grammar));
  parser.feed(query);
  if (!parser.results) {
    // TODO: Better error handling
    // there should be some invalid token information
    throw PARSE_ERROR;
  }

  const result = parser.results[0] as AstNode;

  const parsed = { ...handleNode(result), ast: result as Search };
  logService.debug("Parsed query", parsed);
  return parsed;
}

function handleNode(node: AstNode): { filter: (context: SearchContext) => SearchContext } {
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
    };
  } else if (isAnd(node)) {
    const left = handleNode(node.left);
    const right = handleNode(node.right);
    return {
      filter: (context) => {
        const leftFilteredContext = left.filter(context);
        return right.filter(leftFilteredContext);
      },
    };
  } else if (isParentheses(node)) {
    const inner = handleNode(node.inner);
    return {
      filter: inner.filter,
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
    };
  } else if (isHasField(node)) {
    const fieldTest = fieldNameToRegexTest(node.field);
    return {
      filter: (context) => ({
        ...context,
        ciphers: context.ciphers.filter((cipher) => {
          const foundValues = fieldValues(cipher, fieldTest);
          return foundValues.fields.some((foundValue) => !!foundValue.value);
        }),
      }),
    };
  } else if (isHasAttachment(node)) {
    return {
      filter: (context) => ({
        ...context,
        ciphers: context.ciphers.filter(
          (cipher) => !!cipher.attachments && cipher.attachments.length > 0,
        ),
      }),
    };
  } else if (isHasUri(node)) {
    return {
      filter: (context) => ({
        ...context,
        ciphers: context.ciphers.filter(
          (cipher) => !!cipher?.login?.uris && cipher.login.uris.length > 0,
        ),
      }),
    };
  } else if (isHasFolder(node)) {
    return {
      filter: (context) => ({
        ...context,
        ciphers: context.ciphers.filter((cipher) => !!cipher.folderId),
      }),
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
    };
  } else if (isInCollection(node)) {
    const collectionTest = termToRegexTest(node.collection);
    return {
      filter: (context) => {
        const collectionIds = context.collections
          .filter(
            (collection) =>
              collectionTest.test(collection.name) || collectionTest.test(collection.id),
          )
          .map((collection) => collection.id);
        return {
          ...context,
          ciphers: context.ciphers.filter((cipher) =>
            collectionIds.some((collectionId) => cipher.collectionIds.includes(collectionId)),
          ),
        };
      },
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
    };
  } else if (isInMyVault(node)) {
    return {
      filter: (context) => ({
        ...context,
        ciphers: context.ciphers.filter((cipher) => cipher.organizationId == null),
      }),
    };
  } else if (isInTrash(node)) {
    return {
      filter: (context) => ({
        ...context,
        ciphers: context.ciphers.filter((cipher) => cipher.isDeleted),
      }),
    };
  } else if (isIsFavorite(node)) {
    return {
      filter: (context) => ({
        ...context,
        ciphers: context.ciphers.filter((cipher) => cipher.favorite),
      }),
    };
  } else if (isTypeFilter(node)) {
    const typeTest = fieldNameToRegexTest(node.cipherType);
    return {
      filter: (context) => ({
        ...context,
        ciphers: context.ciphers.filter((cipher) =>
          matchEnum(CipherType, cipher.type, typeTest, node.cipherType),
        ),
      }),
    };
  } else if (isWebsiteFilter(node)) {
    const websiteTest = termToRegexTest(node.website);
    return {
      filter: (context) => ({
        ...context,
        ciphers: context.ciphers.filter((cipher) =>
          cipher?.login?.uris?.some((uri) => websiteTest.test(uri.uri)),
        ),
      }),
    };
  } else if (isWebsiteMatchFilter(node)) {
    const websiteTest = termToRegexTest(node.website);
    const matchTest = termToRegexTest(node.matchType);
    return {
      filter: (context) => ({
        ...context,
        ciphers: context.ciphers.filter((cipher) =>
          cipher?.login?.uris?.some(
            (uri) => matchHostMatchType(uri.match, matchTest) && websiteTest.test(uri.uri),
          ),
        ),
      }),
    };
  } else if (isOrderBy(node)) {
    // TODO: This logic is shaky at best, this operator needs to be rewritten
    const fieldTest = fieldNameToRegexTest(node.field);
    return {
      filter: (context) => {
        const idOrder = context.ciphers
          .map((cipher) => fieldValues(cipher, /.*/i))
          .sort((a, b) => {
            const aValue = a.fields.find((v) =>
              fieldTest.test(v.path.split(".").reverse()[0]),
            )?.value;
            const bValue = b.fields.find((v) =>
              fieldTest.test(v.path.split(".").reverse()[0]),
            )?.value;
            if (aValue === bValue) {
              return 0;
            }
            if (node.direction === OrderDirection.Asc) {
              if (aValue === undefined) {
                return 1;
              }
              if (bValue === undefined) {
                return -1;
              }
              return aValue.localeCompare(bValue) ? -1 : 1;
            } else {
              if (aValue === undefined) {
                return -1;
              }
              if (bValue === undefined) {
                return 1;
              }
              return aValue.localeCompare(bValue) ? 1 : -1;
            }
          })
          .map((fieldValues) => fieldValues.id);
        return {
          ...context,
          ciphers: idOrder.map((id) => context.ciphers.find((cipher) => cipher.id === id)!),
        };
      },
    };
  } else {
    throw new Error("Invalid node\n" + JSON.stringify(node, null, 2));
  }
}

function matchHostMatchType(
  cipherVal: UriMatchStrategySetting | null,
  queryMatch: RegExp,
): boolean {
  if (queryMatch.test("default")) {
    // default match type is stored as null
    return cipherVal == null;
  }

  const matchTypes = Object.keys(UriMatchStrategy)
    .filter((key) => queryMatch.test(key))
    .map((key) => UriMatchStrategy[key as keyof typeof UriMatchStrategy]);
  return cipherVal != null && matchTypes.includes(cipherVal);
}

/**
 * Match a string against an enum value. The matching string is sent in twice to match the enum in both directions,
 * number -> string and string -> number.
 *
 * @param enumObj The Enum type
 * @param cipherVal The existing value on a cipher to test for a match
 * @param valTest The regex test to apply to cipherVal
 * @param targetValue The raw value to test against the cipherVal
 * @returns
 */
function matchEnum(
  enumObj: { [name: string]: any },
  cipherVal: string | number,
  valTest: RegExp,
  targetValue: string,
) {
  return valTest.test(enumObj[cipherVal]) || enumObj[targetValue] === enumObj[cipherVal];
}

function hasTerm(cipher: CipherView, termTest: RegExp, fieldTest: RegExp = /.*/i): boolean {
  const foundValues = fieldValues(cipher, fieldTest);

  return foundValues.fields.some((foundValue) => termTest.test(foundValue.value));
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

const ForbiddenFields = Object.freeze(["login.password", "login.totp", "card.code"]);

const ForbiddenLinkedIds: Readonly<LinkedIdType[]> = Object.freeze([
  LoginLinkedId.Password,
  CardLinkedId.Number,
  CardLinkedId.Code,
]);

type FieldValues = { path: string; value: string }[];
function fieldValues(cipher: CipherView, fieldTest: RegExp): { id: CipherId; fields: FieldValues } {
  const result = {
    id: cipher.id as CipherId,
    fields: recursiveValues(cipher, fieldTest, ""),
  };

  // append custom fields
  for (const field of cipher.fields ?? []) {
    switch (field.type) {
      case FieldType.Text:
        if (fieldTest.test(field.name)) {
          result.fields.push({
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
          result.fields.push({
            path: `customField.${field.name}`,
            value: value,
          });
        }
        break;
      }
      case FieldType.Boolean: {
        if (fieldTest.test(field.name)) {
          result.fields.push({
            path: `customField.${field.name}`,
            value: field.value,
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
      result.fields.push({
        path: `attachment.fileName`,
        value: a.fileName,
      });
    });
  }

  // Purge forbidden paths from results
  result.fields = result.fields.filter(({ path }) => {
    return !ForbiddenFields.includes(path);
  });
  return result;
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
