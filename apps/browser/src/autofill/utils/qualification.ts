import AutofillField from "../models/autofill-field";

const autofillFieldKeywordsCache: WeakMap<
  AutofillField,
  { keywordsSet: Set<string>; stringValue: string }
> = new WeakMap();

/**
 * Normalizes and tokenizes a single attribute value string into a set of keyword tokens.
 * Produces the full lowercased value, tokens split on non-alphanumeric characters (after
 * hyphen removal), and tokens split after additional space removal (e.g. "user id" → "userid").
 */
function tokenizeValue(value: string): Set<string> {
  const keywordsSet = new Set<string>();
  let keywordEl = value.toLowerCase();
  keywordsSet.add(keywordEl);
  keywordEl = keywordEl.replace(/-/g, "");
  keywordEl.split(/[^\p{L}\d]+/gu).forEach((k) => {
    if (k) {
      keywordsSet.add(k);
    }
  });
  keywordEl
    .replace(/\s/g, "")
    .split(/[^\p{L}\d]+/gu)
    .forEach((k) => {
      if (k) {
        keywordsSet.add(k);
      }
    });
  return keywordsSet;
}

/**
 * Collects and tokenizes all qualifying attribute values from a field into a unified
 * keyword set and a comma-joined string value. Results are cached per field reference
 * in {@link autofillFieldKeywordsCache} to avoid redundant computation across repeated calls.
 */
function buildAutofillFieldKeywords(field: AutofillField) {
  if (autofillFieldKeywordsCache.has(field)) {
    return autofillFieldKeywordsCache.get(field)!;
  }
  const attributeValues = [
    field.htmlID,
    field.htmlName,
    field.htmlClass,
    field.type,
    field.title,
    field.placeholder,
    field.autoCompleteType,
    field.dataSetValues,
    field["label-data"],
    field["label-aria"],
    field["label-left"],
    field["label-right"],
    field["label-tag"],
    field["label-top"],
  ];
  const keywordsSet = new Set<string>();
  for (const attributeValue of attributeValues) {
    if (!attributeValue || typeof attributeValue !== "string") {
      continue;
    }
    tokenizeValue(attributeValue).forEach((k) => keywordsSet.add(k));
  }
  const result = { keywordsSet, stringValue: Array.from(keywordsSet).join(",") };
  autofillFieldKeywordsCache.set(field, result);
  return result;
}

/**
 * Returns true if any of the provided keywords is found in the field's attributes.
 * Strips hyphens from input keywords before matching.
 *
 * @param field - The AutofillField to check
 * @param keywords - Keywords to search for
 * @param exactMatch - If true, keyword must be an exact token in the field's normalized
 *   attribute data. If false (default), keyword is searched as a substring across all tokens.
 */
export function fieldContainsKeyword(
  field: AutofillField,
  keywords: string[],
  exactMatch = false,
): boolean {
  const parsedKeywords = keywords.map((k) => k.replace(/-/g, ""));
  const { keywordsSet, stringValue } = buildAutofillFieldKeywords(field);
  if (exactMatch) {
    return parsedKeywords.some((k) => keywordsSet.has(k));
  }
  return parsedKeywords.some((k) => stringValue.indexOf(k) > -1);
}

/**
 * Gathers and normalizes keywords from a potential submit button element. Used
 * to verify if the element submits a login or change password form.
 *
 * @param element - The element to gather keywords from.
 */
export function getSubmitButtonKeywordsSet(element: HTMLElement): Set<string> {
  const keywords = [
    element.textContent,
    element.getAttribute("type"),
    element.getAttribute("value"),
    element.getAttribute("aria-label"),
    element.getAttribute("aria-labelledby"),
    element.getAttribute("aria-describedby"),
    element.getAttribute("title"),
    element.getAttribute("id"),
    element.getAttribute("name"),
    element.getAttribute("class"),
  ];

  const keywordsSet = new Set<string>();
  for (let i = 0; i < keywords.length; i++) {
    const keyword = keywords[i];
    if (typeof keyword === "string") {
      // Iterate over all keywords metadata and split them by non-letter characters.
      // This ensures we check against individual words and not the entire string.
      keyword
        .toLowerCase()
        .replace(/[-\s]/g, "")
        .split(/[^\p{L}]+/gu)
        .forEach((splitKeyword) => {
          if (splitKeyword) {
            keywordsSet.add(splitKeyword);
          }
        });
    }
  }

  return keywordsSet;
}
