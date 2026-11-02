import { FormContent, Fragment, Pathname, TargetingRulesByDomain } from "../types";

import { punycodeToUnicode } from "./punycode";

/**
 * Pure matcher that determines which targeting rules apply to a URL, given an already-resolved
 * {@link TargetingRulesByDomain} set. A URL resolves to its most specific matching entry, in order:
 * page fragment, page forms, site-wide fragment, then hostname-level forms.
 *
 * @returns `FormContent[]` with entries for targeted fill,
 *          `[]` (empty) if the URL is blocklisted (suppress autofill),
 *          `null` if no rules exist (fall through to heuristics)
 */
export function matchTargetingRulesForUrl(
  rules: TargetingRulesByDomain | null,
  url: string,
): FormContent[] | null {
  if (!rules || Object.keys(rules).length === 0) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  let hostRules = rules[parsed.host];

  // www subdomain equivalence: if no entry for www.example.com, try example.com
  if (hostRules === undefined && parsed.host.startsWith("www.")) {
    hostRules = rules[parsed.host.slice(4)];
  }

  // If the direct punycode lookup missed, try the unicode form of the host.
  // This handles rule providers that use unicode host keys (e.g. "münchen.de"
  // instead of "xn--mnchen-3ya.de").
  if (hostRules === undefined && parsed.host.includes("xn--")) {
    const unicodeHost = punycodeToUnicode(parsed.host);
    hostRules = rules[unicodeHost];

    // www subdomain equivalence on the unicode form
    if (hostRules === undefined && unicodeHost.startsWith("www.")) {
      hostRules = rules[unicodeHost.slice(4)];
    }
  }

  // No rules for this host; fall through to heuristics
  if (hostRules === undefined) {
    return null;
  }

  // Hostname blocklisted (null or empty): suppress autofill on all paths
  if (
    hostRules === null ||
    (!hostRules.forms?.length && !hostRules.pathnames && !hostRules.fragments)
  ) {
    return [];
  }

  const fragment = parsed.hash as Fragment | "";
  let siteWideFragmentForms: FormContent[] | undefined;
  if (fragment && hostRules.fragments != null && fragment in hostRules.fragments) {
    const forms = hostRules.fragments[fragment]?.forms;
    siteWideFragmentForms = forms?.length ? forms : [];
  }

  // Check for pathname-specific rules
  // Fall back to root path `/` to enable checking cases where
  // a rule signals a form that is ONLY on the domain's root page
  const pathname = (parsed.pathname.replace(/\/+$/, "") || "/") as Pathname;
  if (hostRules.pathnames != null && pathname in hostRules.pathnames) {
    const pathnameEntry = hostRules.pathnames[pathname];

    // Pathname blocklisted (null/undefined/empty): suppress autofill on this path
    if (
      pathnameEntry == null ||
      (pathnameEntry.forms == null && !Object.keys(pathnameEntry.fragments ?? {}).length)
    ) {
      return [];
    }

    if (fragment && pathnameEntry.fragments != null && fragment in pathnameEntry.fragments) {
      const forms = pathnameEntry.fragments[fragment]?.forms;
      return forms?.length ? forms : [];
    }

    if (pathnameEntry.forms != null) {
      return pathnameEntry.forms.length ? pathnameEntry.forms : [];
    }

    return siteWideFragmentForms ?? null;
  }

  if (siteWideFragmentForms !== undefined) {
    return siteWideFragmentForms;
  }

  // No pathname-specific rule; fall back to hostname-level forms
  return hostRules.forms?.length ? hostRules.forms : null;
}
