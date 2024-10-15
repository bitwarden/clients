import { Parser, Grammar } from "nearley";

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

export function parseQuery(query: string): ProcessInstructions {
  const parser = new Parser(Grammar.fromCompiled(grammar));
  parser.feed(query);
  if (!parser.results) {
    // TODO: Better error handling
    // there should be some invalid token information
    throw new Error("Invalid search query");
  }

  const result = parser.results[0] as AstNode;

  return handleNode(result);
}

function handleNode(node: AstNode): ProcessInstructions {
  if (isSearch(node)) {
    return handleNode(node.d);
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
    return {
      filter: (context) => {
        const filteredCipherIds = context.index.search(node.value).map((r) => r.ref);
        return {
          ...context,
          ciphers: context.ciphers.filter((cipher) => filteredCipherIds.includes(cipher.id)),
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
    return {
      filter: (context) => {
        const filteredCipherIds = context.index
          .search(`${node.field}:${node.term}`)
          .map((r) => r.ref);
        return {
          ...context,
          ciphers: context.ciphers.filter((cipher) => filteredCipherIds.includes(cipher.id)),
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
