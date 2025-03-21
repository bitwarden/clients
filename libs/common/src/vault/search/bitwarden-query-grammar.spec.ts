import { Grammar, Parser } from "nearley";

import { AstNodeBase } from "./ast";
import compiledGrammar from "./bitwarden-query-grammar";

const This = {
  query: "this",
  expectedResults: [
    {
      contents: {
        type: "term",
        value: "this",
      },
      type: "search",
    },
  ],
};

const ThisOrThat = {
  query: "this OR that",
  expectedResults: [
    {
      contents: {
        left: {
          type: "term",
          value: "this",
        },
        right: {
          type: "term",
          value: "that",
        },
        type: "or",
      },
      type: "search",
    },
  ],
};

const QuotedReservedWord = {
  query: '"quoted reserved word NOT"',
  expectedResults: [
    {
      contents: {
        type: "term",
        value: '"quoted reserved word NOT"',
      },
      type: "search",
    },
  ],
};

const CaseSensitiveReservedWord = {
  query: "this or that",
  expectedResults: [
    {
      contents: {
        type: "and",
        left: {
          type: "and",
          left: {
            type: "term",
            value: "this",
          },
          right: {
            type: "term",
            value: "or",
          },
        },
        right: {
          type: "term",
          value: "that",
        },
      },
      type: "search",
    },
  ],
};

const OrOperator = {
  query: "this OR that",
  expectedResults: [
    {
      contents: {
        type: "or",
        left: {
          type: "term",
          value: "this",
        },
        right: {
          type: "term",
          value: "that",
        },
      },
      type: "search",
    },
  ],
};

const Parenthesis = {
  query: "some (times you) need",
  expectedResults: [
    {
      contents: {
        type: "and",
        left: {
          type: "and",
          left: {
            type: "term",
            value: "some",
          },
          right: {
            type: "parentheses",
            inner: {
              type: "and",
              left: {
                type: "term",
                value: "times",
              },
              right: {
                type: "term",
                value: "you",
              },
            },
          },
        },
        right: {
          type: "term",
          value: "need",
        },
      },
      type: "search",
    },
  ],
};

const QuotedFieldTerm = {
  query: 'field:"custom field":fizz',
  expectedResults: [
    {
      contents: {
        type: "fieldTerm",
        field: '"custom field"',
        term: "fizz",
      },
      type: "search",
    },
  ],
};

const HasAttachment = {
  query: "has:attachment",
  expectedResults: [
    {
      contents: {
        type: "hasAttachment",
      },
      type: "search",
    },
  ],
};

const HasUri = {
  query: "has:uri",
  expectedResults: [
    {
      contents: {
        type: "hasUri",
      },
      type: "search",
    },
  ],
};

const HasFolder = {
  query: "has:folder",
  expectedResults: [
    {
      contents: {
        type: "hasFolder",
      },
      type: "search",
    },
  ],
};

const HasCollection = {
  query: "has:collection",
  expectedResults: [
    {
      contents: {
        type: "hasCollection",
      },
      type: "search",
    },
  ],
};

const InFolder = {
  query: "in:folder:fizz",
  expectedResults: [
    {
      contents: {
        type: "inFolder",
        folder: "fizz",
      },
      type: "search",
    },
  ],
};

const InCollection = {
  query: "in:collection:fizz",
  expectedResults: [
    {
      contents: {
        type: "inCollection",
        collection: "fizz",
      },
      type: "search",
    },
  ],
};

const NotLogic = {
  query: "this AND NOT that",
  expectedResults: [
    {
      contents: {
        type: "and",
        left: {
          type: "term",
          value: "this",
        },
        right: {
          type: "not",
          value: {
            type: "term",
            value: "that",
          },
        },
      },
      type: "search",
    },
  ],
};

const AdvancedBoolean = {
  query: "this OR that AND that",
  expectedResults: [
    {
      contents: {
        type: "or",
        left: {
          type: "term",
          value: "this",
        },
        right: {
          type: "and",
          left: {
            type: "term",
            value: "that",
          },
          right: {
            type: "term",
            value: "that",
          },
        },
      },
      type: "search",
    },
  ],
};

const FunctionNot = {
  query: "this NOT(that)",
  expectedResults: [
    {
      type: "search",
      contents: {
        type: "and",
        left: {
          type: "term",
          value: "this",
        },
        right: {
          type: "not",
          value: {
            type: "parentheses",
            inner: {
              type: "term",
              value: "that",
            },
          },
        },
      },
    },
  ],
};

const PartialQuoteBegin = {
  query: '"this',
  expectedResults: [
    {
      contents: {
        type: "term",
        value: '"this',
      },
      type: "search",
    },
  ],
};

const PartialQuoteEnd = {
  query: 'this"',
  expectedResults: [
    {
      contents: {
        type: "term",
        value: 'this"',
      },
      type: "search",
    },
  ],
};

const OrderBy = {
  query: "order:name:asc",
  expectedResults: [
    {
      contents: {
        type: "orderBy",
        field: "name",
        direction: "asc",
      },
      type: "search",
    },
  ],
};

const EmptyParens = "()";

describe("search query grammar", () => {
  const grammar = Grammar.fromCompiled(compiledGrammar);
  let parser: Parser;

  beforeEach(() => {
    parser = new Parser(grammar);
  });

  it.each([
    This,
    ThisOrThat,
    QuotedReservedWord,
    CaseSensitiveReservedWord,
    OrOperator,
    Parenthesis,
    QuotedFieldTerm,
    HasAttachment,
    HasFolder,
    HasCollection,
    HasUri,
    InFolder,
    InCollection,
    NotLogic,
    AdvancedBoolean,
    FunctionNot,
    PartialQuoteBegin,
    PartialQuoteEnd,
    OrderBy,
  ])("$query", ({ query, expectedResults }) => {
    parser.feed(query);
    expect(parser.results.length).toEqual(expectedResults.length);

    for (let i = 0; i < parser.results.length; i++) {
      expect(purgeAstPositionMarkers(parser.results[i])).toEqual(expectedResults[i]);
    }
  });

  it.each([EmptyParens])("should not parse %s", (query) => {
    expect(() => parser.feed(query)).toThrow();
  });
});

function purgeAstPositionMarkers(ast: AstNodeBase): Partial<AstNodeBase> {
  if (ast == null) {
    return ast;
  }

  const result: Partial<AstNodeBase> = { ...ast };

  delete result.start;
  delete result.end;
  delete result.length;

  for (const key in result) {
    const k = key as keyof AstNodeBase;
    if (result[k] != null && typeof result[k] === "object") {
      result[k] = purgeAstPositionMarkers(result[k] as any) as any;
    }
  }
  return result;
}
