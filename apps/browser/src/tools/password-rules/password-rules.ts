import { Utils } from "@bitwarden/common/platform/misc/utils";

// Apple password-manager-resources, quirks/password-rules.json at eb9d43dc (MIT, see LICENSE.md)
import quirks from "./password-rules.json";

type Quirk = { "password-rules": string; "exact-domain-match-only"?: boolean };

// a Map, so a host such as "constructor" can't read from the object prototype
const QUIRKS = new Map<string, Quirk>(Object.entries(quirks as Record<string, Quirk>));

/** Finds the password rules for a URL's host. A rule also covers its subdomains unless it is
 *  exact-domain-match-only.
 *  @returns the domain the rules belong to and the rules, or `null` when none apply.
 */
export function findPasswordRules(
  url: string | undefined,
): { domain: string; rules: string } | null {
  // https only, so TLS has verified the host
  const parsed = Utils.getUrl(url);
  if (parsed?.protocol !== "https:") {
    return null;
  }

  // `hostname` is lowercase and punycode, and excludes credentials, port and path
  const labels = parsed.hostname.replace(/\.$/, "").split(".");

  // match on whole labels only, from the full host up to the parent of the top-level domain
  for (let i = 0; i < labels.length - 1; i++) {
    const domain = labels.slice(i).join(".");
    const quirk = QUIRKS.get(domain);
    if (quirk && (i === 0 || !quirk["exact-domain-match-only"])) {
      return { domain, rules: quirk["password-rules"] };
    }
  }

  return null;
}
