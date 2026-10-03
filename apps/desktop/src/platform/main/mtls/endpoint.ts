import { EndpointKey } from "../../models/mtls";

/** Electron may report a TLS challenge as host:port rather than a URL. */
export function normalizeChallengeEndpoint(input: string): EndpointKey {
  if (/^https:\/\//i.test(input) || /^wss:\/\//i.test(input)) {
    return normalizeEndpoint(input);
  }
  // Accept only an authority with an explicit port. Never reinterpret paths,
  // credentials, another URL scheme, or an unbracketed IPv6 address.
  if (!/^(?:\[[0-9a-fA-F:.]+\]|[^\s/:@?#\\]+):[0-9]+$/.test(input)) {
    throw new Error("invalid-endpoint");
  }
  return normalizeEndpoint(`https://${input}`);
}

/** Return the TLS destination only; paths and URL schemes do not own identities. */
export function normalizeEndpoint(input: string): EndpointKey {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("invalid-endpoint");
  }

  if (
    (url.protocol !== "https:" && url.protocol !== "wss:") ||
    !url.hostname ||
    url.username ||
    url.password
  ) {
    throw new Error("invalid-endpoint");
  }

  const hostname = url.hostname.startsWith("[") ? url.hostname : url.hostname.replace(/\.$/, "");
  if (!hostname) {
    throw new Error("invalid-endpoint");
  }
  const port = url.port || "443";
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    throw new Error("invalid-endpoint");
  }
  return `${hostname}:${port}`;
}
