/**
 * Best-effort guard against sending credentials to an obviously unsafe destination
 * (SSRF into loopback/private/link-local/cloud-metadata addresses, or a non-https scheme).
 *
 * This only inspects the URL as written, before it's ever fetched. It does not guarantee
 * anything about what happens once the request is sent:
 *  - A hostname (as opposed to an IP literal) is not resolved here — there is no DNS
 *    resolver available in this context — so a name that currently resolves to a public
 *    address but later resolves (or is rebound) to a private one will still pass.
 *  - A response that redirects to an unsafe location is not caught by this check at all;
 *    callers that follow redirects need to either disable them or re-validate on each hop.
 * This is not a substitute for server-side or network-layer SSRF controls.
 */

export type UnsafeUrlReasonCode = "invalid" | "scheme" | "host";

export interface UnsafeUrlReason {
  code: UnsafeUrlReasonCode;
  /** log the rejected scheme or hostname only, never the full URL or query string. */
  detail: string;
}

function isPrivateIpv4(hostname: string): boolean {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
  if (!match) {
    return false;
  }

  const octets = match.slice(1, 5).map(Number);
  if (octets.some((octet) => octet > 255)) {
    return false;
  }

  const [a, b] = octets;
  return (
    a === 0 || // "this network" (includes the unspecified address 0.0.0.0)
    a === 127 || // loopback
    a === 10 || // RFC1918
    (a === 172 && b >= 16 && b <= 31) || // RFC1918
    (a === 192 && b === 168) || // RFC1918
    (a === 100 && b >= 64 && b <= 127) || // RFC6598 shared address space (CGNAT)
    (a === 169 && b === 254) // link-local, incl. cloud metadata 169.254.169.254
  );
}

function isPrivateIpv6(hostname: string): boolean {
  const normalized = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!normalized.includes(":")) {
    return false;
  }

  if (normalized === "::" || normalized === "::1") {
    return true; // unspecified address, or loopback
  }

  // IPv4-mapped (::ffff:a.b.c.d) or the deprecated IPv4-compatible (::a.b.c.d) form,
  // both normalized by URL parsing into two trailing hex groups.
  const ipv4Embedded = /^::(?:ffff:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(normalized);
  if (ipv4Embedded) {
    const high = parseInt(ipv4Embedded[1], 16);
    const low = parseInt(ipv4Embedded[2], 16);
    const octets = [(high >> 8) & 0xff, high & 0xff, (low >> 8) & 0xff, low & 0xff];
    return isPrivateIpv4(octets.join("."));
  }

  const firstHextet = normalized.split(":")[0];
  if (/^fe[89ab][0-9a-f]$/.test(firstHextet)) {
    return true; // fe80::/10 link-local
  }
  if (/^f[cd][0-9a-f]{2}$/.test(firstHextet)) {
    return true; // fc00::/7 unique local
  }

  return false;
}

function sameOrigin(url: URL, trustedOrigin: string): boolean {
  if (url.origin === "null") {
    return false; // opaque origin; never treat two opaque origins as the same
  }

  try {
    return url.origin === new URL(trustedOrigin).origin;
  } catch {
    return false;
  }
}

/**
 * Returns the reason `url` is unsafe to fetch, or `null` when it's safe.
 *
 * @param trustedOrigin an origin the caller has already authenticated to and trusts (e.g. the
 *  configured server's API origin). A url on that origin is exempt from the scheme/host check —
 *  the server returning its own origin isn't a new SSRF target, even when that origin happens to
 *  be plaintext http or a private address, which is common for self-hosted deployments.
 */
export function unsafeUrlReason(url: string, trustedOrigin?: string): UnsafeUrlReason | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { code: "invalid", detail: "" };
  }

  if (trustedOrigin && sameOrigin(parsed, trustedOrigin)) {
    return null;
  }

  if (parsed.protocol !== "https:") {
    return { code: "scheme", detail: parsed.protocol };
  }

  const hostname = parsed.hostname.toLowerCase().replace(/\.+$/, "");
  const isLocalhost = hostname === "localhost" || hostname.endsWith(".localhost");
  if (isLocalhost || isPrivateIpv4(hostname) || isPrivateIpv6(hostname)) {
    return { code: "host", detail: hostname };
  }

  return null;
}
