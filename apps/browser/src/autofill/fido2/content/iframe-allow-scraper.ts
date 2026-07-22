/**
 * Scrapes the `<iframe>` elements in a document, capturing the attributes the
 * Permissions Policy delegation algorithm needs to evaluate cross-origin frames.
 *
 * Why this exists: `iframe.allow` is the parent's instruction to delegate
 * Permissions Policy features to the child frame. The child can't read its own
 * `frameElement.allow` across origin boundaries — `window.frameElement` returns
 * null for cross-origin iframes. So the parent's content script has to scrape
 * the attribute on the child's behalf, and the background uses the report to
 * answer "what `allow=` does frame X have?" when evaluating its policy.
 *
 * This module is pure: it takes a Document and returns a list. Sending the
 * result to the background is the caller's responsibility.
 */

/**
 * One scraped iframe. Identifies the iframe by its resolved `src` URL (or marks
 * it as srcdoc/no-src) and carries the `allow` attribute string verbatim — the
 * delegation algorithm parses the attribute itself.
 */
export type IframeAllowAttribute = {
  /**
   * Resolved absolute URL of the iframe's `src`. Empty string for `srcdoc`
   * iframes and iframes with no `src` set.
   */
  readonly src: string;
  /**
   * Raw value of the iframe's `allow` attribute, or empty string when the
   * attribute is absent. Parsing is the delegation layer's job.
   */
  readonly allow: string;
  /**
   * True when the iframe uses a `srcdoc` attribute (no network URL). Srcdoc
   * iframes inherit their parent's origin and aren't matchable by URL; the
   * delegation algorithm currently leaves them on the spec-default allowlist.
   */
  readonly srcdoc: boolean;
};

/**
 * Returns the `allow=` attribute report for every `<iframe>` element in the
 * given document. Order matches the document order returned by
 * `querySelectorAll("iframe")`. Returns an empty array when the document has
 * no iframes.
 */
export function scrapeIframeAllowAttributes(doc: Document): IframeAllowAttribute[] {
  const iframes = Array.from(doc.querySelectorAll("iframe"));
  return iframes.map((iframe) => ({
    // `iframe.src` gives the resolved absolute URL when the document has a base
    // URL; otherwise it falls back to the raw attribute. Matching against
    // navigation URLs in the background uses the same resolution semantics.
    src: iframe.src ?? "",
    // Read `allow` via `getAttribute` rather than the `iframe.allow` accessor.
    // The reflected `.allow` property was added later than other iframe
    // properties and isn't implemented in every environment (notably jsdom);
    // the attribute itself is always readable.
    allow: iframe.getAttribute("allow") ?? "",
    srcdoc: iframe.hasAttribute("srcdoc"),
  }));
}
