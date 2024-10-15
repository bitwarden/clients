// Generated automatically by nearley, version 2.20.1
// http://github.com/Hardmath123/nearley
// Bypasses TS6133. Allow declared but unused functions.
// @ts-ignore
function id(d: any[]): any {
  return d[0];
}
declare var lparen: any;
declare var rparen: any;
declare var AND: any;
declare var OR: any;
declare var string: any;
declare var access: any;
declare var func_has: any;
declare var func_in: any;
declare var func_is: any;
declare var NOT: any;
declare var WS: any;

const moo = require("moo");

let lexer = moo.compile({
  // Logical operators
  NOT: "NOT", // Right associative unary not
  AND: "AND", // Left associative and
  OR: "OR", // Left associative or
  WS: /[ \t]+/, // Whitespace
  lparen: "(", // Left parenthesis
  rparen: ")", // Right parenthesis
  // Special search functions
  // Note, there have been issues with reserverd words in the past, so we're using a prefix
  func_has: "has:",
  func_in: "in:",
  func_is: "is:",
  // function parameter separator
  access: ":",
  // string match, includes quoted strings with escaped quotes and backslashes
  string: /(?:"(?:\\["\\]|[^\n"\\])*"|(?:\\["\\]|[^\s\(\):])+)/,
});

interface NearleyToken {
  value: any;
  [key: string]: any;
}

interface NearleyLexer {
  reset: (chunk: string, info: any) => void;
  next: () => NearleyToken | undefined;
  save: () => any;
  formatError: (token: never) => string;
  has: (tokenType: string) => boolean;
}

interface NearleyRule {
  name: string;
  symbols: NearleySymbol[];
  postprocess?: (d: any[], loc?: number, reject?: {}) => any;
}

type NearleySymbol = string | { literal: any } | { test: (token: any) => boolean };

interface Grammar {
  Lexer: NearleyLexer | undefined;
  ParserRules: NearleyRule[];
  ParserStart: string;
}

const grammar: Grammar = {
  Lexer: lexer,
  ParserRules: [
    {
      name: "search",
      symbols: ["_", "OR", "_"],
      postprocess: function (d) {
        return { type: "search", d: d[1], start: d[1].start, end: d[1].end, length: d[1].length };
      },
    },
    {
      name: "PARENTHESES",
      symbols: [
        lexer.has("lparen") ? { type: "lparen" } : lparen,
        "_",
        "OR",
        "_",
        lexer.has("rparen") ? { type: "rparen" } : rparen,
      ],
      postprocess: function (d) {
        const start = d[0].offset;
        const end = d[4].offset;
        return { type: "parentheses", inner: d[2], d: d, start, end, length: end - start + 1 };
      },
    },
    { name: "PARENTHESES", symbols: ["TERM"], postprocess: id },
    {
      name: "AND",
      symbols: ["AND", "_", lexer.has("AND") ? { type: "AND" } : AND, "_", "PARENTHESES"],
      postprocess: function (d) {
        return {
          type: "and",
          left: d[0],
          right: d[4],
          d: d,
          start: d[0].start,
          end: d[4].end,
          length: d[4].end - d[0].start + 1,
        };
      },
    },
    {
      name: "AND",
      symbols: ["AND", "_", "PARENTHESES"],
      postprocess: function (d) {
        return {
          type: "and",
          left: d[0],
          right: d[2],
          d: d,
          start: d[0].start,
          end: d[2].end,
          length: d[2].end - d[0].start + 1,
        };
      },
    },
    { name: "AND", symbols: ["PARENTHESES"], postprocess: id },
    {
      name: "OR",
      symbols: ["OR", "_", lexer.has("OR") ? { type: "OR" } : OR, "_", "AND"],
      postprocess: function (d) {
        return {
          type: "or",
          left: d[0],
          right: d[4],
          d: d,
          start: d[0].start,
          end: d[4].end,
          length: d[4].end - d[0].start + 1,
        };
      },
    },
    { name: "OR", symbols: ["AND"], postprocess: id },
    {
      name: "TERM",
      symbols: [lexer.has("string") ? { type: "string" } : string],
      postprocess: function (d) {
        const start = d[0].offset;
        const end = d[0].offset + d[0].value.length;
        return { type: "term", value: d[0].value, d: d[0], start, end, length: d[0].value.length };
      },
    },
    {
      name: "TERM",
      symbols: [
        lexer.has("string") ? { type: "string" } : string,
        lexer.has("access") ? { type: "access" } : access,
        lexer.has("string") ? { type: "string" } : string,
      ],
      postprocess: function (d) {
        const start = d[0].offset;
        const end = d[2].offset + d[2].value.length;
        return {
          type: "field term",
          field: d[0],
          term: d[2],
          d: d,
          start,
          end,
          length: end - start + 1,
        };
      },
    },
    {
      name: "TERM",
      symbols: [lexer.has("func_has") ? { type: "func_has" } : func_has, { literal: "attachment" }],
      postprocess: function (d) {
        const start = d[0].offset;
        const length = 14;
        return { type: "hasAttachment", d: d, start, end: d[0].offset + length, length };
      },
    },
    {
      name: "TERM",
      symbols: [lexer.has("func_has") ? { type: "func_has" } : func_has, { literal: "uri" }],
      postprocess: function (d) {
        const start = d[0].offset;
        const length = 7;
        return { type: "hasUri", d: d, start, end: d[0].offset + length, length };
      },
    },
    {
      name: "TERM",
      symbols: [lexer.has("func_has") ? { type: "func_has" } : func_has, { literal: "folder" }],
      postprocess: function (d) {
        const start = d[0].offset;
        const length = 10;
        return { type: "hasFolder", d: d, start, end: d[0].offset + length, length };
      },
    },
    {
      name: "TERM",
      symbols: [lexer.has("func_has") ? { type: "func_has" } : func_has, { literal: "collection" }],
      postprocess: function (d) {
        const start = d[0].offset;
        const length = 14;
        return { type: "hasCollection", d: d, start, end: d[0].offset + length, length };
      },
    },
    {
      name: "TERM",
      symbols: [
        lexer.has("func_in") ? { type: "func_in" } : func_in,
        { literal: "folder" },
        lexer.has("access") ? { type: "access" } : access,
        lexer.has("string") ? { type: "string" } : string,
      ],
      postprocess: function (d) {
        const start = d[0].offset;
        const end = d[3].offset + d[3].value.length;
        return { type: "inFolder", folder: d[3], d: d, start, end, length: end - start };
      },
    },
    {
      name: "TERM",
      symbols: [
        lexer.has("func_in") ? { type: "func_in" } : func_in,
        { literal: "collection" },
        lexer.has("access") ? { type: "access" } : access,
        lexer.has("string") ? { type: "string" } : string,
      ],
      postprocess: function (d) {
        const start = d[0].offset;
        const end = d[3].offset + d[3].value.length;
        return {
          type: "inCollection",
          collection: d[3],
          d: d,
          start,
          end,
          length: end - start + 1,
        };
      },
    },
    {
      name: "TERM",
      symbols: [
        lexer.has("func_in") ? { type: "func_in" } : func_in,
        { literal: "org" },
        lexer.has("access") ? { type: "access" } : access,
        lexer.has("string") ? { type: "string" } : string,
      ],
      postprocess: function (d) {
        const start = d[0].offset;
        const end = d[3].offset + d[3].value.length;
        return { type: "inOrg", org: d[3], d: d, start, end, length: end - start + 1 };
      },
    },
    {
      name: "TERM",
      symbols: [lexer.has("func_is") ? { type: "func_is" } : func_is, { literal: "favorite" }],
      postprocess: function (d) {
        const start = d[0].offset;
        const length = 11;
        return { type: "isFavorite", d: d, start, end: d[0].offset + length, length };
      },
    },
    {
      name: "TERM",
      symbols: [lexer.has("NOT") ? { type: "NOT" } : NOT, "_", "PARENTHESES"],
      postprocess: function (d) {
        const start = d[0].offset;
        return {
          type: "not",
          value: d[2],
          d: d,
          start,
          end: d[2].end,
          length: d[2].end - d[0].offset + 1,
        };
      },
    },
    { name: "_$ebnf$1", symbols: [] },
    {
      name: "_$ebnf$1",
      symbols: ["_$ebnf$1", lexer.has("WS") ? { type: "WS" } : WS],
      postprocess: (d) => d[0].concat([d[1]]),
    },
    {
      name: "_",
      symbols: ["_$ebnf$1"],
      postprocess: function (d) {
        return null;
      },
    },
  ],
  ParserStart: "search",
};

export default grammar;
