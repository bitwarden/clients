// Selector generator for webmapper.
//
// Strategy per element (within its own root):
//   1. #id (if id looks stable)
//   2. tag[name="..."]
//   3. tag[data-testid|data-test|data-qa|data-cy|...="..."]
//   4. tag[autocomplete="..."] (skipping "off")
//   5. tag[type="..."]
//   6. unstable #id as last-resort attribute
//   7. structural fallback: a > b:nth-of-type(i) > ... absolute child-chain from
//      the root element (flagged brittle; no `:scope` — see structuralFallback)
//
// Composite candidates (e.g. tag[name="x"][type="email"]) are added when no
// single attribute is unique but a pair is.
//
// Shadow DOM: walks element → root → host → root → ... and joins per-segment
// selectors with " >>> ".

export interface GeneratedSelector {
  /** Chosen selector, joined with `>>>` across shadow boundaries. */
  selector: string | null;
  /** How many elements the chosen selector matches within its own root. */
  matches: number;
  /** Other unique candidates worth offering the user. */
  alternates: string[];
  warnings: string[];
  /** True when any segment fell back to a positional/structural chain. */
  structural: boolean;
}

const STABLE_DATA_ATTRS = [
  "data-testid",
  "data-test-id",
  "data-test",
  "data-qa",
  "data-cy",
  "data-trackid",
  "data-track-id",
  "data-automation-id",
];

// Patterns that look auto-generated. Match the value as a whole.
const UNSTABLE_VALUE_PATTERNS = [
  /^css-[a-z0-9]{4,}$/i,
  /^(jsx|emotion|mui|ant|chakra|sc)-[a-z0-9-]+$/i,
  /^_ngcontent-/i,
  /^ng-tns-/i,
  /^[a-z]{1,3}[-_]?[a-f0-9]{8,}$/i, // short prefix + hash
  /^[a-zA-Z0-9_-]{24,}$/, // very long opaque
];

// Predicate on attribute *content*. Callers handle absence (no attribute at
// all) before calling.
function looksUnstable(value: string): boolean {
  return UNSTABLE_VALUE_PATTERNS.some((re) => re.test(value));
}

function quoteAttr(value: string): string {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function attrSel(tag: string, attr: string, value: string): string {
  return `${tag}[${attr}=${quoteAttr(value)}]`;
}

function rootOf(el: Element): ShadowRoot | Document {
  const root = el.getRootNode();
  return root instanceof ShadowRoot || root instanceof Document ? root : document;
}

function countIn(root: ShadowRoot | Document, selector: string): number {
  try {
    return root.querySelectorAll(selector).length;
  } catch {
    return -1;
  }
}

function singleAttributeCandidates(el: Element): string[] {
  const tag = el.tagName.toLowerCase();
  // The schema requires the segment before an iframe `>>>` to include the
  // literal `iframe` tag, so skip bare `#id` candidates for iframes.
  const requireTag = tag === "iframe";
  const out: string[] = [];
  const stableId = el.id && !looksUnstable(el.id);

  if (stableId) {
    if (!requireTag) {
      out.push(`#${CSS.escape(el.id)}`);
    }
    out.push(`${tag}#${CSS.escape(el.id)}`);
  }

  const name = el.getAttribute("name");
  if (name) {
    out.push(attrSel(tag, "name", name));
  }

  for (const attr of STABLE_DATA_ATTRS) {
    const v = el.getAttribute(attr);
    if (v && !looksUnstable(v)) {
      out.push(attrSel(tag, attr, v));
    }
  }

  const autocomplete = el.getAttribute("autocomplete");
  if (autocomplete && autocomplete !== "off") {
    out.push(attrSel(tag, "autocomplete", autocomplete));
  }

  const type = el.getAttribute("type");
  if (type) {
    out.push(attrSel(tag, "type", type));
  }

  if (el.id && !stableId) {
    out.push(requireTag ? `${tag}#${CSS.escape(el.id)}` : `#${CSS.escape(el.id)}`);
  }

  return [...new Set(out)];
}

function pairCandidates(el: Element): string[] {
  const tag = el.tagName.toLowerCase();
  const attrs: [string, string][] = [];
  const push = (attr: string) => {
    const v = el.getAttribute(attr);
    if (v) {
      attrs.push([attr, v]);
    }
  };
  push("name");
  push("type");
  push("autocomplete");
  for (const a of STABLE_DATA_ATTRS) {
    push(a);
  }

  const out: string[] = [];
  for (let i = 0; i < attrs.length; i++) {
    for (let j = i + 1; j < attrs.length; j++) {
      out.push(
        `${tag}[${attrs[i][0]}=${quoteAttr(attrs[i][1])}][${attrs[j][0]}=${quoteAttr(attrs[j][1])}]`,
      );
    }
  }
  return out;
}

function structuralFallback(el: Element): string {
  const parts: string[] = [];
  let cur: Element | null = el;
  while (cur && cur.nodeType === 1 && cur.parentElement) {
    const tag = cur.tagName.toLowerCase();
    const sameTagSiblings = Array.from(cur.parentElement.children).filter(
      (c) => c.tagName === cur!.tagName,
    );
    if (sameTagSiblings.length > 1) {
      const idx = sameTagSiblings.indexOf(cur) + 1;
      parts.unshift(`${tag}:nth-of-type(${idx})`);
    } else {
      parts.unshift(tag);
    }
    cur = cur.parentElement;
  }
  if (cur && cur.nodeType === 1) {
    parts.unshift(cur.tagName.toLowerCase());
  }
  // Absolute child-chain from the root element (no `:scope`): when a stored
  // selector is evaluated with `document.querySelectorAll`, `:scope` resolves to
  // the documentElement (like `:root`), so `:scope > html > …` asks for an
  // `<html>` nested inside `<html>` and matches nothing. The chain already
  // includes the root element as its first segment, so it stands alone.
  return parts.join(" > ");
}

interface SegmentResult {
  selector: string;
  alternates: string[];
  warnings: string[];
  structural: boolean;
}

function chooseForSegment(element: Element): SegmentResult {
  const root = rootOf(element);
  const warnings: string[] = [];
  const unique: string[] = [];

  const singles = singleAttributeCandidates(element);
  for (const cand of singles) {
    if (countIn(root, cand) === 1) {
      unique.push(cand);
    }
  }

  if (unique.length === 0) {
    for (const cand of pairCandidates(element)) {
      if (countIn(root, cand) === 1) {
        unique.push(cand);
      }
    }
  }

  let chosen: string;
  let alternates: string[] = [];
  let structural = false;
  if (unique.length > 0) {
    chosen = unique[0];
    alternates = unique.slice(1);
  } else {
    chosen = structuralFallback(element);
    structural = true;
    const count = countIn(root, chosen);
    warnings.push(
      count === 1
        ? "uses positional :nth-of-type — brittle"
        : `no unique selector found (matches ${count})`,
    );
  }

  if (element.id && looksUnstable(element.id)) {
    warnings.push(`id "${element.id}" looks auto-generated`);
  }

  return { selector: chosen, alternates, warnings, structural };
}

// DEFERRED: closed shadow roots. composedPath() is retargeted at a closed boundary,
// so capture sees the host, not the clicked element. Descending needs
// DomQueryService.getShadowRoot plus coordinate hit-testing; walking *up* is fine.
//
// Walks up shadow boundaries, returning one element per segment from outermost
// (doc-rooted) to innermost (the target element).
function shadowSegments(element: Element): Element[] {
  const segments: Element[] = [];
  let cur: Element | null = element;
  while (cur) {
    segments.unshift(cur);
    const root = cur.getRootNode();
    if (root instanceof ShadowRoot) {
      cur = root.host;
    } else {
      break;
    }
  }
  return segments;
}

export function generateSelector(element: Element | null): GeneratedSelector {
  if (!element || element.nodeType !== 1) {
    return {
      selector: null,
      matches: 0,
      alternates: [],
      warnings: ["target is not an element"],
      structural: false,
    };
  }

  const segments = shadowSegments(element);
  const parts: string[] = [];
  const warnings: string[] = [];
  let alternates: string[] = [];
  let structural = false;

  for (let i = 0; i < segments.length; i++) {
    const seg = chooseForSegment(segments[i]);
    parts.push(seg.selector);
    warnings.push(...seg.warnings);
    structural = structural || seg.structural;
    if (i === segments.length - 1) {
      alternates = seg.alternates;
    }
  }

  const selector = parts.join(" >>> ");
  const matches = countIn(rootOf(element), parts[parts.length - 1]);
  // An alternate replaces `selector` wholesale, so it needs the same shadow prefix.
  const prefix = parts.slice(0, -1);

  return {
    selector,
    matches,
    alternates: alternates.map((alternate) => [...prefix, alternate].join(" >>> ")),
    warnings,
    structural,
  };
}
