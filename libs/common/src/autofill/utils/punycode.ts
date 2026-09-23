/**
 * Decodes a single punycode-encoded label (without the "xn--" prefix)
 * back to its unicode representation per RFC 3492.
 */
function decodePunycodeLabel(rawEncoded: string): string {
  // Reject empty and overlong inputs. DNS labels are limited to 63 octets;
  // the "xn--" prefix consumes 4, leaving at most 59 for the encoded body.
  if (rawEncoded.length === 0 || rawEncoded.length > 59) {
    throw new Error("Invalid punycode: label length out of range");
  }

  // RFC 3492 Section 5: decoding is case-insensitive
  const encoded = rawEncoded.toLowerCase();
  const base = 36;
  const tMin = 1;
  const tMax = 26;
  const initialBias = 72;
  const initialN = 128;

  const output: number[] = [];
  let i = 0;
  let n = initialN;
  let bias = initialBias;

  // Split at the last delimiter; everything before is literal ASCII
  const lastDelim = encoded.lastIndexOf("-");
  if (lastDelim >= 0) {
    for (let j = 0; j < lastDelim; j++) {
      output.push(encoded.charCodeAt(j));
    }
  }

  let pos = lastDelim >= 0 ? lastDelim + 1 : 0;

  while (pos < encoded.length) {
    const oldi = i;
    let w = 1;

    for (let k = base; ; k += base) {
      if (pos >= encoded.length) {
        throw new Error("Invalid punycode");
      }

      const code = encoded.charCodeAt(pos++);
      let digit: number;
      if (code >= 0x61 && code <= 0x7a) {
        digit = code - 0x61; // a-z
      } else if (code >= 0x30 && code <= 0x39) {
        digit = code - 0x30 + 26; // 0-9
      } else {
        throw new Error("Invalid punycode character");
      }

      // Check overflow BEFORE mutation to avoid IEEE 754 precision loss
      if (digit > Math.floor((Number.MAX_SAFE_INTEGER - i) / w)) {
        throw new Error("Invalid punycode: overflow");
      }
      i += digit * w;

      const t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
      if (digit < t) {
        break;
      }

      const baseMinusT = base - t;
      if (w > Math.floor(Number.MAX_SAFE_INTEGER / baseMinusT)) {
        throw new Error("Invalid punycode: overflow");
      }
      w *= baseMinusT;
    }

    const out = output.length + 1;
    bias = adapt(i - oldi, out, oldi === 0);

    n += Math.floor(i / out);
    if (n > 0x10ffff) {
      throw new Error("Invalid punycode: code point out of range");
    }
    i %= out;

    output.splice(i, 0, n);
    i++;
  }

  return String.fromCodePoint(...output);
}

/**
 * Adapts the bias value for punycode decoding per RFC 3492 Section 6.1.
 * The bias controls the threshold boundaries that determine how many
 * digits are needed to represent each delta, dynamically tuning the
 * encoding efficiency based on previously seen code points.
 */
function adapt(rawDelta: number, numPoints: number, firstTime: boolean): number {
  const base = 36;
  const tMin = 1;
  const tMax = 26;
  const skew = 38;
  const damp = 700;

  let delta = firstTime ? Math.floor(rawDelta / damp) : Math.floor(rawDelta / 2);
  delta += Math.floor(delta / numPoints);

  let k = 0;
  while (delta > ((base - tMin) * tMax) >> 1) {
    delta = Math.floor(delta / (base - tMin));
    k += base;
  }

  return k + Math.floor(((base - tMin + 1) * delta) / (delta + skew));
}

/**
 * Converts a punycode-encoded hostname to its unicode representation.
 * Labels prefixed with "xn--" are decoded; others are passed through as-is.
 *
 * @example
 * punycodeToUnicode("xn--mnchen-3ya.de")  // "münchen.de"
 * punycodeToUnicode("example.com")        // "example.com"
 * punycodeToUnicode("example.com:8443")   // "example.com:8443"
 */
export function punycodeToUnicode(host: string): string {
  // IPv6 addresses (e.g. "[::1]:8443") cannot contain punycode labels;
  // return as-is to avoid misinterpreting colons as port separators.
  if (host.startsWith("[")) {
    return host;
  }

  // Separate port if present (e.g. "xn--mnchen-3ya.de:8443")
  const colonIndex = host.lastIndexOf(":");
  let hostname = host;
  let port = "";

  if (colonIndex >= 0) {
    const possiblePort = host.slice(colonIndex + 1);
    if (/^\d+$/.test(possiblePort)) {
      hostname = host.slice(0, colonIndex);
      port = ":" + possiblePort;
    }
  }

  const labels = hostname.split(".").map((label) => {
    if (label.toLowerCase().startsWith("xn--")) {
      try {
        return decodePunycodeLabel(label.slice(4));
      } catch {
        return label;
      }
    }
    return label;
  });

  return labels.join(".") + port;
}
