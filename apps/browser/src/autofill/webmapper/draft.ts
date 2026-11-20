// Draft state: one working entry per (host, pathname). The shape mirrors a
// slice of map-the-web's forms.jsonc, with extra per-selector metadata
// (warnings, alternates) stripped at export time.
//
// Edit operations are parametrised by `slot` so the three list kinds share one
// implementation. Container has no `add`: it goes through the pending-container
// chooser instead.
//
// These operations mutate the draft in place; persistence lives in the storage
// service, and its updateDraft supplies the copy they mutate.

// A selector is a string, or an array of strings for sequences (one logical
// value spread across multiple inputs) — matching the schema's compositeSelector
// item shape.
export type SelectorValue = string | string[];

export interface SelectorEntry {
  selector: SelectorValue;
  warnings: string[];
  alternates: SelectorValue[];
}

export interface ContainerCandidate {
  selector: string;
  label: string;
  tag: string;
  structural: boolean;
  warnings: string[];
}

export interface WebmapperForm {
  category: string | null;
  container: SelectorEntry[] | null;
  fields: Record<string, SelectorEntry[]>;
  actions: Record<string, SelectorEntry[]>;
  pendingContainer: ContainerCandidate[] | null;
}

export interface WebmapperDraft {
  host: string;
  pathname: string | null;
  irrelevant: boolean;
  forms: WebmapperForm[];
  activeFormIndex: number;
}

export type Slot =
  { kind: "fields"; key: string } | { kind: "actions"; key: string } | { kind: "container" };

function entry(
  selector: SelectorValue,
  warnings: string[] = [],
  alternates: SelectorValue[] = [],
): SelectorEntry {
  return { selector, warnings, alternates };
}

export function emptyForm(): WebmapperForm {
  return {
    category: null,
    container: null,
    fields: {},
    actions: {},
    pendingContainer: null,
  };
}

export function emptyDraft(host: string, pathname: string | null): WebmapperDraft {
  return {
    host,
    pathname: pathname ?? null,
    irrelevant: false,
    forms: [emptyForm()],
    activeFormIndex: 0,
  };
}

function ensureActiveForm(draft: WebmapperDraft): WebmapperForm {
  if (!draft.forms[draft.activeFormIndex]) {
    draft.forms[draft.activeFormIndex] = emptyForm();
  }
  return draft.forms[draft.activeFormIndex];
}

// Read the list at `slot` in `form`, or null/undefined if not present.
// Never creates a list; callers that need to write use `ensureSlotList`.
function slotList(form: WebmapperForm | undefined, slot: Slot): SelectorEntry[] | null | undefined {
  if (!form) {
    return null;
  }
  if (slot.kind === "container") {
    return form.container;
  }
  return form[slot.kind]?.[slot.key];
}

function ensureSlotList(form: WebmapperForm, slot: Slot): SelectorEntry[] {
  if (slot.kind === "container") {
    form.container ??= [];
    return form.container;
  }
  const map = form[slot.kind];
  map[slot.key] ??= [];
  return map[slot.key];
}

// Drop the slot's storage when its list is empty: delete the key for
// fields/actions, null out the singleton for container.
function clearEmptySlot(form: WebmapperForm, slot: Slot): void {
  const list = slotList(form, slot);
  if (!list || list.length > 0) {
    return;
  }
  if (slot.kind === "container") {
    form.container = null;
  } else {
    delete form[slot.kind][slot.key];
  }
}

// Add a captured selector to the active form. Container uses the pending-
// candidate flow instead; passing kind:"container" here is a usage error.
export function addSelector(draft: WebmapperDraft, slot: Slot, captured: SelectorEntry): void {
  if (slot.kind === "container") {
    throw new Error("addSelector: container uses pickContainerCandidate");
  }
  const list = ensureSlotList(ensureActiveForm(draft), slot);
  if (list.some((e) => e.selector === captured.selector)) {
    return;
  }
  list.push(captured);
}

export function editSelectorAt(
  draft: WebmapperDraft,
  formIndex: number,
  slot: Slot,
  selectorIndex: number,
  newSelector: SelectorValue,
): void {
  const list = slotList(draft.forms[formIndex], slot);
  if (!list?.[selectorIndex]) {
    return;
  }
  list[selectorIndex] = entry(newSelector, [], list[selectorIndex].alternates);
}

// Replace a selector with one of its alternates; the previously-chosen
// selector moves to the alternates list so the swap is reversible.
export function swapAlternateAt(
  draft: WebmapperDraft,
  formIndex: number,
  slot: Slot,
  selectorIndex: number,
  alternateIndex: number,
): void {
  const list = slotList(draft.forms[formIndex], slot);
  const current = list?.[selectorIndex];
  if (!current) {
    return;
  }
  const alternate = current.alternates?.[alternateIndex];
  if (!alternate) {
    return;
  }
  const remaining = current.alternates.filter((_, i) => i !== alternateIndex);
  list[selectorIndex] = entry(alternate, [], [current.selector, ...remaining]);
}

export function removeSelectorAt(
  draft: WebmapperDraft,
  formIndex: number,
  slot: Slot,
  selectorIndex: number,
): void {
  const form = draft.forms[formIndex];
  const list = slotList(form, slot);
  if (!list) {
    return;
  }
  list.splice(selectorIndex, 1);
  clearEmptySlot(form, slot);
}

export function setPendingContainer(
  draft: WebmapperDraft,
  candidates: ContainerCandidate[] | null,
): void {
  ensureActiveForm(draft).pendingContainer = candidates ?? null;
}

export function pickContainerCandidate(
  draft: WebmapperDraft,
  formIndex: number,
  candidateIndex: number,
): void {
  const form = draft.forms[formIndex];
  if (!form?.pendingContainer) {
    return;
  }
  const candidate = form.pendingContainer[candidateIndex];
  if (!candidate) {
    return;
  }
  form.container = [entry(candidate.selector, candidate.warnings, [])];
  form.pendingContainer = null;
}

export function cancelPendingContainer(draft: WebmapperDraft, formIndex: number): void {
  if (draft.forms[formIndex]) {
    draft.forms[formIndex].pendingContainer = null;
  }
}

export function fieldSelectorsForActive(draft: WebmapperDraft): string[] {
  const form = draft.forms[draft.activeFormIndex];
  if (!form) {
    return [];
  }
  return Object.values(form.fields)
    .flat()
    .map((e) => e.selector)
    .filter((s): s is string => typeof s === "string");
}

export function setCategory(
  draft: WebmapperDraft,
  formIndex: number,
  category: string | null,
): void {
  if (!draft.forms[formIndex]) {
    return;
  }
  draft.forms[formIndex].category = category || null;
}

export function addForm(draft: WebmapperDraft): void {
  draft.forms.push(emptyForm());
  draft.activeFormIndex = draft.forms.length - 1;
}

export function removeForm(draft: WebmapperDraft, formIndex: number): void {
  draft.forms.splice(formIndex, 1);
  // Removing an earlier form renumbers the rest, so follow the selected form to
  // its new index rather than leaving the index pointing at its neighbour.
  if (formIndex < draft.activeFormIndex) {
    draft.activeFormIndex--;
  }
  if (draft.forms.length === 0) {
    draft.forms.push(emptyForm());
  }
  if (draft.activeFormIndex >= draft.forms.length) {
    draft.activeFormIndex = draft.forms.length - 1;
  }
}

export function setActiveForm(draft: WebmapperDraft, formIndex: number): void {
  if (draft.forms[formIndex]) {
    draft.activeFormIndex = formIndex;
  }
}

export function toggleIrrelevant(draft: WebmapperDraft): void {
  draft.irrelevant = !draft.irrelevant;
}

function isFormPristine(form: WebmapperForm): boolean {
  return (
    !form.category &&
    Object.keys(form.fields).length === 0 &&
    Object.keys(form.actions).length === 0 &&
    !form.container?.length
  );
}

/**
 * Nothing captured and not marked irrelevant — exporting it would serialize a
 * host-wide `null`, indistinguishable from marking the whole host irrelevant.
 * An irrelevant draft is not pristine: it maps to `null` on purpose and exports.
 */
export function isDraftPristine(draft: WebmapperDraft): boolean {
  return !draft.irrelevant && draft.forms.every(isFormPristine);
}

// The reasons a form isn't ready to export, in display order; empty means ready.
// The single source both validateDraft (as messages) and serializeForm (as a
// skip) read from, so the "needs a category and a field" rule can't drift apart.
function formExportBlockers(form: WebmapperForm): string[] {
  const blockers: string[] = [];
  if (!form.category) {
    blockers.push("pick a category");
  }
  if (Object.keys(form.fields).length === 0) {
    blockers.push("capture at least one field");
  }
  return blockers;
}

// Validate a draft for export. Returns an array of issue strings; empty array
// means it's ready to copy as JSONC. Returns no issues for pristine drafts so
// the panel doesn't shout at a freshly-opened page.
export function validateDraft(draft: WebmapperDraft): string[] {
  const issues: string[] = [];
  if (draft.irrelevant) {
    const hasContent = draft.forms.some((f) => !isFormPristine(f));
    if (hasContent) {
      issues.push("Page is marked irrelevant but has form content — clear one or the other.");
    }
    return issues;
  }
  if (draft.forms.every(isFormPristine)) {
    return issues;
  }

  draft.forms.forEach((form, i) => {
    if (isFormPristine(form)) {
      return;
    }
    for (const blocker of formExportBlockers(form)) {
      issues.push(`Form ${i}: ${blocker}.`);
    }
  });
  return issues;
}

// Serialize a draft as a complete, schema-valid forms.jsonc document for one
// host. The user can copy this whole document to validate, or lift just the
// host subtree to merge into an existing forms.jsonc.
export function toJsonc(draft: WebmapperDraft): string {
  const hostEntry = draft.irrelevant ? irrelevantEntry(draft) : buildHostEntry(draft);
  const doc = {
    schemaVersion: "1.0.0",
    hosts: { [draft.host]: hostEntry },
  };
  return JSON.stringify(doc, null, 2);
}

// An irrelevant page maps to null — either the whole host, or just this pathname
// when one is set (leaving other paths on the host free to map normally).
function irrelevantEntry(draft: WebmapperDraft): unknown {
  if (draft.pathname) {
    return { pathnames: { [draft.pathname]: null } };
  }
  return null;
}

function buildHostEntry(draft: WebmapperDraft): unknown {
  const formsArray = draft.forms.map(serializeForm).filter(Boolean);
  if (formsArray.length === 0) {
    return null;
  }

  if (draft.pathname) {
    return { pathnames: { [draft.pathname]: { forms: formsArray } } };
  }
  return { forms: formsArray };
}

function flattenSelectors(map: Record<string, SelectorEntry[]>): Record<string, SelectorValue[]> {
  const out: Record<string, SelectorValue[]> = {};
  for (const [key, items] of Object.entries(map)) {
    out[key] = items.map((e) => e.selector);
  }
  return out;
}

function serializeForm(form: WebmapperForm): unknown {
  if (formExportBlockers(form).length > 0) {
    return null;
  }
  const out: Record<string, unknown> = { category: form.category };
  if (form.container?.length) {
    out.container = form.container.map((e) => e.selector);
  }
  out.fields = flattenSelectors(form.fields);
  if (Object.keys(form.actions).length) {
    out.actions = flattenSelectors(form.actions);
  }
  return out;
}
