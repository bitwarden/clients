import AutofillField from "../models/autofill-field";
import AutofillForm from "../models/autofill-form";
import AutofillPageDetails from "../models/autofill-page-details";
import { AutoFillConstants } from "../services/autofill-constants";

export const KeywordMatchMode = Object.freeze({
  AppearsWithin: "appearsWithin",
  MatchesToken: "matchesToken",
} as const);
export type KeywordMatchMode = (typeof KeywordMatchMode)[keyof typeof KeywordMatchMode];

// Module-level cache
const autofillFieldKeywordsCache: WeakMap<
  AutofillField,
  { keywordsSet: Set<string>; stringValue: string }
> = new WeakMap();

const autofillFormKeywordsCache: WeakMap<
  AutofillForm,
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
 * True if any keyword matches a token from the field. With `appearsWithin` (default), the
 * keyword may appear as a substring of any token; `matchesToken` requires an exact token.
 * Hyphens are stripped from keywords before matching.
 */
export function fieldContainsKeyword(
  field: AutofillField,
  keywords: readonly string[],
  mode: KeywordMatchMode = KeywordMatchMode.AppearsWithin,
): boolean {
  const parsedKeywords = keywords.map((k) => k.replace(/-/g, ""));
  const { keywordsSet, stringValue } = buildAutofillFieldKeywords(field);
  if (mode === KeywordMatchMode.AppearsWithin) {
    return parsedKeywords.some((k) => stringValue.indexOf(k) > -1);
  }
  return parsedKeywords.some((k) => keywordsSet.has(k));
}

/**
 * True if any keyword matches a token from the form. With `appearsWithin` (default), the
 * keyword may appear as a substring of any token; `matchesToken` requires an exact token.
 * Hyphens are stripped from keywords before matching.
 */
export function formContainsKeyword(
  form: AutofillForm,
  keywords: readonly string[],
  mode: KeywordMatchMode = KeywordMatchMode.AppearsWithin,
): boolean {
  const parsedKeywords = keywords.map((k) => k.replace(/-/g, ""));
  const { keywordsSet, stringValue } = buildAutofillFormKeywords(form);
  if (mode === KeywordMatchMode.AppearsWithin) {
    return parsedKeywords.some((k) => stringValue.indexOf(k) > -1);
  }
  return parsedKeywords.some((k) => keywordsSet.has(k));
}

/**
 * Tokenizes form attrs only — heading text is handled by classifyHeadings.
 */
function buildAutofillFormKeywords(form: AutofillForm) {
  if (autofillFormKeywordsCache.has(form)) {
    return autofillFormKeywordsCache.get(form)!;
  }
  const stringAttributes = [form.htmlID, form.htmlName, form.htmlAction, form.htmlClass];
  const keywordsSet = new Set<string>();
  for (const attributeValue of stringAttributes) {
    if (!attributeValue || typeof attributeValue !== "string") {
      continue;
    }
    tokenizeValue(attributeValue).forEach((k) => keywordsSet.add(k));
  }
  const result = { keywordsSet, stringValue: Array.from(keywordsSet).join(",") };
  autofillFormKeywordsCache.set(form, result);
  return result;
}

/**
 * Walks headings closest-first; first match against the login or identity keyword
 * lists wins, silent headings skipped. Returns a context signal, not a verdict.
 */
export function classifyHeadings(
  headings: readonly string[] | undefined,
  loginKeywords: readonly string[],
  identityKeywords: readonly string[],
): "login" | "identity" | "ambiguous" {
  if (!headings?.length) {
    return "ambiguous";
  }
  const loginTokens = loginKeywords.map((k) => k.replace(/-/g, "").toLowerCase());
  const identityTokens = identityKeywords.map((k) => k.replace(/-/g, "").toLowerCase());
  for (const heading of headings) {
    if (!heading) {
      continue;
    }
    const stringValue = Array.from(tokenizeValue(heading)).join(",");
    if (loginTokens.some((k) => stringValue.indexOf(k) > -1)) {
      return "login";
    }
    if (identityTokens.some((k) => stringValue.indexOf(k) > -1)) {
      return "identity";
    }
  }
  return "ambiguous";
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
  for (const keyword of keywords) {
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

/**
 * True if the field's parent form carries a non-login signal, scanned against
 * {@link AutoFillConstants.StrongNonLoginKeywords}.
 */
function isNonLoginFormContext(field: AutofillField, pageDetails: AutofillPageDetails): boolean {
  const fieldForm = field.form;
  if (!fieldForm) {
    return false;
  }

  const parentForm = pageDetails.forms?.[fieldForm];
  if (!parentForm) {
    return false;
  }

  return formContainsKeyword(parentForm, AutoFillConstants.StrongNonLoginKeywords);
}

/**
 * True if the field or any same-form sibling matches a keyword.
 * Returns false when the field has no form to scope siblings against.
 */
function anyFieldInFormMatches(
  field: AutofillField,
  pageDetails: AutofillPageDetails,
  keywords: readonly string[],
): boolean {
  if (fieldContainsKeyword(field, keywords)) {
    return true;
  }

  if (!field.form) {
    return false;
  }

  return pageDetails.fields.some(
    (sibling) =>
      sibling !== field && sibling.form === field.form && fieldContainsKeyword(sibling, keywords),
  );
}

/**
 * Checks form context plus field/siblings for non-login keywords. Headings are
 * deferred to isAmbiguousFieldNonLogin pending a confidence-weighting system.
 */
export function isNonLoginUsernameField(
  field: AutofillField,
  pageDetails: AutofillPageDetails,
): boolean {
  if (isNonLoginFormContext(field, pageDetails)) {
    return true;
  }

  return anyFieldInFormMatches(field, pageDetails, AutoFillConstants.StrongNonLoginKeywords);
}

/**
 * Tie-break for an ambiguously structured login input (lone username, no password).
 * Headings go through classifyHeadings; a closer login signal short-circuits.
 */
export function isAmbiguousFieldNonLogin(
  field: AutofillField,
  pageDetails: AutofillPageDetails,
): boolean {
  const keywords = AutoFillConstants.ComprehensiveNonLoginKeywords;
  const parentForm = field.form ? pageDetails.forms?.[field.form] : undefined;

  if (parentForm) {
    const headingClassification = classifyHeadings(
      parentForm.htmlAncestorHeadings,
      AutoFillConstants.StrongLoginHeadingKeywords,
      keywords,
    );
    if (headingClassification === "login") {
      return false;
    }
    if (headingClassification === "identity") {
      return true;
    }
    if (formContainsKeyword(parentForm, keywords)) {
      return true;
    }
  }

  return anyFieldInFormMatches(field, pageDetails, keywords);
}
