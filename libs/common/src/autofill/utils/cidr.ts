import { NeverDomains } from "../../models/domain/domain-service";

const IPV4_PATTERN = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/**
 * Parses a dotted-quad IPv4 address into an unsigned 32-bit integer.
 *
 * @returns The numeric value, or null if the value is not a valid IPv4 address
 */
function parseIpv4(value: string): number | null {
  const match = IPV4_PATTERN.exec(value);
  if (match == null) {
    return null;
  }

  let result = 0;
  for (let i = 1; i <= 4; i++) {
    const octet = Number(match[i]);
    if (octet > 255) {
      return null;
    }
    result = result * 256 + octet;
  }
  return result;
}

/**
 * Parses an IPv4 CIDR range such as `192.0.2.0/24`.
 *
 * @returns The first address of the range and its size, or null if the value is not an IPv4 CIDR range
 */
function parseIpv4Cidr(value: string): { start: number; size: number } | null {
  const [address, prefix, ...rest] = value.trim().split("/");
  if (prefix == null || rest.length > 0 || !/^\d{1,2}$/.test(prefix)) {
    return null;
  }

  const prefixLength = Number(prefix);
  const ip = parseIpv4(address);
  if (ip == null || prefixLength > 32) {
    return null;
  }

  const size = 2 ** (32 - prefixLength);
  return { start: Math.floor(ip / size) * size, size };
}

/**
 * Whether the value is a valid IPv4 CIDR range, e.g. `192.0.2.0/24`.
 */
export function isIpv4Cidr(value: string): boolean {
  return parseIpv4Cidr(value) != null;
}

/**
 * Whether the hostname is an IPv4 address that falls within the given IPv4 CIDR range.
 * Anything that is not an IPv4 address or an IPv4 CIDR range never matches.
 */
export function isHostnameInCidr(hostname: string, cidr: string): boolean {
  const range = parseIpv4Cidr(cidr);
  const ip = parseIpv4(hostname);
  if (range == null || ip == null) {
    return false;
  }
  return ip >= range.start && ip < range.start + range.size;
}

/**
 * Whether the hostname is excluded, either by an exact entry or by an IPv4 CIDR range entry.
 */
export function isHostnameExcluded(hostname: string, excludedDomains: NeverDomains): boolean {
  if (excludedDomains == null) {
    return false;
  }
  if (excludedDomains[hostname] !== undefined) {
    return true;
  }
  return Object.keys(excludedDomains).some((entry) => isHostnameInCidr(hostname, entry));
}
