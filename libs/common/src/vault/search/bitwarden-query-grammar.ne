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
  func_field:         'field:',
  func_has:           'has:',
  func_in:            'in:',
  func_is:            'is:',
  func_type:          'type:',
  func_website:       'website:',
  // Ordering functions and parameters
  func_order:         'order:',
  param_dir:          {match: /:(?:asc|desc|ASC|DESC)/, value: (s: string) => s.substring(1,s.length).toLowerCase()},
  // function parameter separator
  access:        ':',  
  // string match, includes quoted strings with escaped quotes and backslashes
  string:        /(?:"(?:\\["\\]|[^\n"\\])*"|(?:\\["\\]|[^\s\(\):])+)/,
})
%}

@lexer lexer

search -> _ OR _                      {% function(d) { return { type: 'search', contents: d[1], start: d[1].start, end: d[1].end, length: d[1].length } } %}

PARENTHESES -> %lparen _ OR _ %rparen {% function(d) { const start = d[0].offset; const end = d[4].offset; return { type: 'parentheses', inner: d[2], start, end, length: end - start + 1 } } %}
            | TERM {% id %}

AND -> AND _ %AND _ PARENTHESES       {% function(d) { return { type: 'and', left: d[0], right: d[4], start: d[0].start, end: d[4].end, length: d[4].end - d[0].start + 1 } } %}
    | AND _ PARENTHESES               {% function(d) { return { type: 'and', left: d[0], right: d[2], start: d[0].start, end: d[2].end, length: d[2].end - d[0].start + 1 }} %}
    | PARENTHESES                     {% id %}

OR -> OR _ %OR _ AND                  {% function(d) { return { type: 'or', left: d[0], right: d[4], start: d[0].start, end: d[4].end, length: d[4].end - d[0].start + 1 } } %}
    | AND                             {% id %}

TERM -> 
      # naked string search term, search all fields
      %string                                  {% function(d) { const start = d[0].offset; const end = d[0].offset + d[0].value.length; return { type: 'term', value: d[0].value, start, end, length: d[0].value.length } } %} 
      # specified field search term
      | %func_field %string %access %string    {% function(d) { const start = d[0].offset; const end = d[3].offset + d[3].value.length; return { type: 'fieldTerm', field: d[1].value, term: d[3].value, start, end, length: end - start + 1 } } %}
      # Has specified field as non-null
      | %func_has %func_field %string          {% function(d) { const start = d[0].offset; const end = d[2].offset + d[2].value.length; return { type: 'hasField', field: d[2].value, start, end, length: end - start + 1 } } %}
      # only items with attachments
      | %func_has "attachment"                 {% function(d) { const start = d[0].offset; const length = 14; return { type: 'hasAttachment', start, end: d[0].offset + length, length } } %}
      # only items with URIs
      | %func_has "uri"                        {% function(d) { const start = d[0].offset; const length = 7; return { type: 'hasUri', start, end: d[0].offset + length, length } } %}
      # only items assigned to a folder
      | %func_has "folder"                     {% function(d) { const start = d[0].offset; const length = 10; return { type: 'hasFolder', start, end: d[0].offset + length, length } } %}
      # only items assigned to a collection
      | %func_has "collection"                 {% function(d) { const start = d[0].offset; const length = 14; return { type: 'hasCollection', start, end: d[0].offset + length, length } } %}
      # only items assigned to a specified folder
      | %func_in "folder" %access %string      {% function(d) { const start = d[0].offset; const end = d[3].offset + d[3].value.length; return { type: 'inFolder', folder: d[3].value, start, end, length: end - start } } %}
      # only items assigned to a specified collection
      | %func_in "collection" %access %string  {% function(d) { const start = d[0].offset; const end = d[3].offset + d[3].value.length; return { type: 'inCollection', collection: d[3].value, start, end, length: end - start + 1 } } %}
      # only items assigned to a specified organization
      | %func_in "org" %access %string         {% function(d) { const start = d[0].offset; const end = d[3].offset + d[3].value.length; return { type: 'inOrg', org: d[3].value, start, end, length: end - start + 1 } } %}
      # only items in personal vault
      | %func_in "my_vault"                    {% function(d) { const start = d[0].offset; const length = 11; return { type: 'inMyVault', start, end: start + length, length } } %}
      # only items in trash
      | %func_in "trash"                       {% function(d) { const start = d[0].offset; const length = 8; return { type: 'inTrash', start, end: start + length, length } } %}
      # only items marked as favorites
      | %func_is "favorite"                    {% function(d) { const start = d[0].offset; const length = 11; return { type: 'isFavorite', start, end: start + length, length } } %}
      # only items of given type type
      | %func_type %string                     {% function(d) { const start = d[0].offset; const end = d[1].offset + d[1].value.length; return { type: 'type', cipherType: d[1].value, start, end, length: end - start + 1 } } %}
      # only items with a specified website
      | %func_website %string                  {% function(d) { const start = d[0].offset; const end = d[1].offset + d[1].value.length; return { type: 'website', website: d[1].value, start, end, length: end - start + 1 } } %}
      # only items with a specified website and a given match pattern
      | %func_website %string %access %string  {% function(d) { const start = d[0].offset; const end = d[3].offset + d[3].value.length; return { type: 'websiteMatch', website: d[1].value, matchType: d[3].value, start, end, length: end - start + 1 } } %}
      # order by a specified field
      | %func_order %string %param_dir         {% function(d) { const start = d[0].offset; const end = d[2].offset + d[2].value.length; return { type: 'orderBy', field: d[1].value, direction: d[2].value, start, end, length: end - start + 1 } } %}
      # Boolean NOT operator
      | %NOT _ PARENTHESES                     {% function(d) { const start = d[0].offset; return { type: 'not', value: d[2], start, end: d[2].end, length: d[2].end - d[0].offset + 1 } } %}

_ -> %WS:*     {% function(d) {return null } %}
