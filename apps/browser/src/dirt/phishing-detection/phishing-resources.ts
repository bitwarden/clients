export type PhishingResource = {
  name?: string;
  remoteUrl: string;
  checksumUrl: string;
  todayUrl: string;
  /** Matcher used to decide whether a given URL matches an entry from this resource */
  match: (url: URL, entry: string) => boolean;
};

export const PhishingResourceType = Object.freeze({
  Domains: "domains",
  Links: "links",
} as const);

export type PhishingResourceType = (typeof PhishingResourceType)[keyof typeof PhishingResourceType];

export const PHISHING_RESOURCES: Record<PhishingResourceType, PhishingResource[]> = {
  [PhishingResourceType.Domains]: [
    {
      name: "Phishing.Database Domains",
      remoteUrl:
        "https://raw.githubusercontent.com/Phishing-Database/Phishing.Database/master/phishing-domains-ACTIVE.txt",
      checksumUrl:
        "https://raw.githubusercontent.com/Phishing-Database/checksums/refs/heads/master/phishing-domains-ACTIVE.txt.md5",
      todayUrl:
        "https://raw.githubusercontent.com/Phishing-Database/Phishing.Database/refs/heads/master/phishing-domains-NEW-today.txt",
      match: (url: URL, entry: string) => {
        if (!entry) {
          return false;
        }
        const candidate = entry.trim().toLowerCase().replace(/\/$/, "");
        // If entry contains a scheme, strip it for comparison
        const e = candidate.replace(/^https?:\/\//, "");
        // Compare against hostname or host+path
        if (e === url.hostname.toLowerCase()) {
          return true;
        }
        const urlNoProto = url.href
          .toLowerCase()
          .replace(/https?:\/\//, "")
          .replace(/\/$/, "");
        return urlNoProto === e || urlNoProto.startsWith(e + "/");
      },
    },
  ],
  [PhishingResourceType.Links]: [
    {
      name: "Phishing.Database Links",
      remoteUrl:
        "https://raw.githubusercontent.com/Phishing-Database/Phishing.Database/master/phishing-links-ACTIVE.txt",
      checksumUrl:
        "https://raw.githubusercontent.com/Phishing-Database/checksums/refs/heads/master/phishing-links-ACTIVE.txt.md5",
      todayUrl:
        "https://raw.githubusercontent.com/Phishing-Database/Phishing.Database/refs/heads/master/phishing-links-NEW-today.txt",
      match: (url: URL, entry: string) => {
        if (!entry) {
          return false;
        }
        // Basic HTML entity decode for common cases (the lists sometimes contain &amp;)
        const decodeHtml = (s: string) => s.replace(/&amp;/g, "&");

        const normalizedEntry = decodeHtml(entry.trim()).toLowerCase().replace(/\/$/, "");

        // Normalize URL for comparison - always strip protocol for consistent matching
        const normalizedUrl = decodeHtml(url.href).toLowerCase().replace(/\/$/, "");
        const urlNoProto = normalizedUrl.replace(/^https?:\/\//, "");

        // Strip protocol from entry if present (http:// and https:// should be treated as equivalent)
        const entryNoProto = normalizedEntry.replace(/^https?:\/\//, "");

        // Compare full path (without protocol) - exact match
        if (urlNoProto === entryNoProto) {
          return true;
        }

        // Check if URL starts with entry (prefix match for subpaths/query/hash)
        // e.g., entry "site.com/phish" matches "site.com/phish/subpage" or "site.com/phish?id=1"
        if (
          urlNoProto.startsWith(entryNoProto + "/") ||
          urlNoProto.startsWith(entryNoProto + "?") ||
          urlNoProto.startsWith(entryNoProto + "#")
        ) {
          return true;
        }

        return false;
      },
    },
  ],
};

export function getPhishingResources(
  type: PhishingResourceType,
  index = 0,
): PhishingResource | undefined {
  const list = PHISHING_RESOURCES[type] ?? [];
  return list[index];
}
