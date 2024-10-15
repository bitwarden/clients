@preprocessor typescript
@{%
const moo = require("moo");

let lexer = moo.compile({
  // Logical operators
  NOT:          'NOT', // Right associative unary not
  AND:          'AND', // Left associative and
  OR:           'OR', // Left associative or
  WS:            /[ \t]+/, // Whitespace
  lparen:        '(', // Left parenthesis
  rparen:        ')', // Right parenthesis
  // Special search functions
  // Note, there have been issues with reserverd words in the past, so we're using a prefix
  func_has:           'has:',
  func_in:            'in:',
  func_is:            'is:',
  // function parameter separator
  access:        ':',  
  // string match, includes quoted strings with escaped quotes and backslashes
  string:        /(?:"(?:\\["\\]|[^\n"\\])*"|(?:\\["\\]|[^\s\(\):])+)/,
})
%}

@lexer lexer

search -> _ OR _                      {% function(d) { return { type: 'search', d: d[1], start: d[1].start, end: d[1].end, length: d[1].length } } %}

PARENTHESES -> %lparen _ OR _ %rparen {% function(d) { const start = d[0].offset; const end = d[4].offset; return { type: 'parentheses', inner: d[2], d:d, start, end, length: end - start + 1 } } %}
            | TERM {% id %}

AND -> AND _ %AND _ PARENTHESES       {% function(d) { return { type: 'and', left: d[0], right: d[4], d:d, start: d[0].start, end: d[4].end, length: d[4].end - d[0].start + 1 } } %}
    | AND _ PARENTHESES               {% function(d) { return { type: 'and', left: d[0], right: d[2], d:d, start: d[0].start, end: d[2].end, length: d[2].end - d[0].start + 1 }} %}
    | PARENTHESES                     {% id %}

OR -> OR _ %OR _ AND                  {% function(d) { return { type: 'or', left: d[0], right: d[4], d:d, start: d[0].start, end: d[4].end, length: d[4].end - d[0].start + 1 } } %}
    | AND                             {% id %}

TERM -> 
      # naked string search term, search all fields
      %string                                 {% function(d) { const start = d[0].offset; const end = d[0].offset + d[0].value.length; return { type: 'term', value: d[0].value, d: d[0], start, end, length: d[0].value.length } } %} 
      # specified field search term
      | %string %access %string               {% function(d) { const start = d[0].offset; const end = d[2].offset + d[2].value.length; return { type: 'field term', field: d[0], term: d[2], d: d, start, end, length: end - start + 1 } } %}
      # only items with attachments
      | %func_has "attachment"                {% function(d) { const start = d[0].offset; const length = 14; return { type: 'hasAttachment', d: d, start, end: d[0].offset + length, length } } %}
      # only items with URIs
      | %func_has "uri"                       {% function(d) { const start = d[0].offset; const length = 7; return { type: 'hasUri', d:d, start, end: d[0].offset + length, length } } %}
      # only items assigned to a folder
      | %func_has "folder"                    {% function(d) { const start = d[0].offset; const length = 10; return { type: 'hasFolder', d:d, start, end: d[0].offset + length, length } } %}
      # only items assigned to a collection
      | %func_has "collection"                {% function(d) { const start = d[0].offset; const length = 14; return { type: 'hasCollection', d:d, start, end: d[0].offset + length, length } } %}
      # only items assigned to a specified folder
      | %func_in "folder" %access %string     {% function(d) { const start = d[0].offset; const end = d[3].offset + d[3].value.length; return { type: 'inFolder', folder: d[3], d:d, start, end, length: end - start } } %}
      # only items assigned to a specified collection
      | %func_in "collection" %access %string {% function(d) { const start = d[0].offset; const end = d[3].offset + d[3].value.length; return { type: 'inCollection', collection: d[3], d:d, start, end, length: end - start + 1 } } %}
      # only items assigned to a specified organization
      | %func_in "org" %access %string        {% function(d) { const start = d[0].offset; const end = d[3].offset + d[3].value.length; return { type: 'inOrg', org: d[3], d:d, start, end, length: end - start + 1 } } %}
      # only items marked as favorites
      | %func_is "favorite"                   {% function(d) { const start = d[0].offset; const length = 11; return { type: 'isFavorite', d:d, start, end: d[0].offset + length, length } } %}
      # Boolean NOT operator
      | %NOT _ PARENTHESES                    {% function(d) { const start = d[0].offset; return { type: 'not', value: d[2], d:d, start, end: d[2].end, length: d[2].end - d[0].offset + 1 } } %}

_ -> %WS:*     {% function(d) {return null } %}
