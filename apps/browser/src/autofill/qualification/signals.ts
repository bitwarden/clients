import AutofillField from "../models/autofill-field";
import AutofillForm from "../models/autofill-form";
import AutofillPageDetails from "../models/autofill-page-details";
import { tokenizeValue } from "../utils/qualification";

import { AmbientSignals, AmbientSource, FieldUnit, SignalSnapshot, TightSignals } from "./internal";

const EXCLUDED_TYPES: ReadonlySet<string> = new Set([
  "hidden",
  "submit",
  "button",
  "image",
  "reset",
  "file",
]);

export function isClassifiable(field: AutofillField): boolean {
  const type = (field.type ?? "").toLowerCase();
  if (type && EXCLUDED_TYPES.has(type)) {
    return false;
  }
  if (field["data-bwignore"]) {
    return false;
  }
  return true;
}

export function normalize(value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function buildFieldUnits(pageDetails: AutofillPageDetails): FieldUnit[] {
  const ambient = pageAmbient(pageDetails);
  return pageDetails.fields.filter(isClassifiable).map((field) => ({
    source: field,
    signals: extractSignals(field, pageDetails, ambient),
  }));
}

function extractSignals(
  field: AutofillField,
  pageDetails: AutofillPageDetails,
  pageAmbient: PageAmbient,
): SignalSnapshot {
  const form = field.form ? pageDetails.forms[field.form] : null;
  return {
    opid: field.opid,
    tight: extractTight(field),
    ambient: extractAmbient(form, pageAmbient),
  };
}

function extractTight(field: AutofillField): TightSignals {
  return {
    autocomplete: parseAutocompleteTokens(field.autoCompleteType),
    type: field.type ? field.type.toLowerCase() : null,
    inputMode: field.inputMode ? field.inputMode.toLowerCase() : null,
    idName: normalize(`${field.htmlID ?? ""} ${field.htmlName ?? ""}`),
    placeholder: normalize(field.placeholder),
    label: normalize(joinLabels(field)),
    dataset: normalize(field.dataSetValues ?? null),
    maxLength: field.maxLength ?? null,
    viewable: field.viewable === true,
  };
}

function extractAmbient(form: AutofillForm | null, pageAmbient: PageAmbient): AmbientSignals {
  return {
    formAttrs: form
      ? buildAmbientSources([form.htmlAction, form.htmlName, form.htmlID, form.htmlClass])
      : [],
    submitButtonText: form ? buildAmbientSources(form.submitButtonText ?? []) : [],
    headings: form ? buildAmbientSources(form.htmlAncestorHeadings ?? []) : [],
    pageTitle: pageAmbient.pageTitle,
    urlPath: pageAmbient.urlPath,
  };
}

function buildAmbientSources(
  values: ReadonlyArray<string | null | undefined>,
): ReadonlyArray<AmbientSource> {
  const out: AmbientSource[] = [];
  for (const value of values) {
    if (typeof value !== "string" || value.length === 0) {
      continue;
    }
    out.push({ raw: value, tokens: tokenizeValue(value) });
  }
  return out;
}

function buildAmbientSource(value: string | null | undefined): AmbientSource | null {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }
  return { raw: value, tokens: tokenizeValue(value) };
}

type PageAmbient = {
  readonly pageTitle: AmbientSource | null;
  readonly urlPath: AmbientSource | null;
};

function pageAmbient(pageDetails: AutofillPageDetails): PageAmbient {
  return {
    pageTitle: buildAmbientSource(pageDetails.title),
    urlPath: buildAmbientSource(safePathname(pageDetails.url)),
  };
}

function safePathname(rawUrl: string): string {
  try {
    return new URL(rawUrl).pathname;
  } catch {
    return "";
  }
}

function parseAutocompleteTokens(raw: string | null | undefined): ReadonlySet<string> {
  if (!raw) {
    return new Set<string>();
  }
  const tokens = raw
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  return new Set(tokens);
}

function joinLabels(field: AutofillField): string {
  return [
    field["label-tag"],
    field["label-aria"],
    field["label-data"],
    field["label-left"],
    field["label-right"],
    field["label-top"],
    field.title,
  ]
    .filter((s): s is string => typeof s === "string" && s.length > 0)
    .join(" ");
}
