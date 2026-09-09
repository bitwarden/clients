// URL → { host, pathname } following map-the-web's authoring conventions:
// - default ports are stripped by URL.host already
// - leading "www." is stripped (canonical = non-www) per the Forms Map README
// - all trailing slashes are stripped, root stays "/" — matching the key
//   DomainSettingsService.getFormsForUrl looks up, so authored keys resolve
// Returns null if the URL is not http/https.

export interface ParsedUrl {
  host: string;
  pathname: string;
}

export function parseUrl(url: string): ParsedUrl | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return null;
  }

  const host = u.host.replace(/^www\./, "");
  const pathname = u.pathname.replace(/\/+$/, "") || "/";
  return { host, pathname };
}
