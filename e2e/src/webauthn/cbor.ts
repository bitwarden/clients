/**
 * A CBOR value, as far as attestation objects and COSE keys need: integers, byte strings, text
 * strings and maps. Maps keep their insertion order, so give keys in CTAP2 canonical order.
 */
export type CborValue = number | Uint8Array | string | Map<CborValue, CborValue>;

function head(majorType: number, length: number): Uint8Array {
  const type = majorType << 5;
  if (length < 24) {
    return Uint8Array.of(type | length);
  }
  if (length < 0x100) {
    return Uint8Array.of(type | 24, length);
  }
  if (length < 0x10000) {
    return Uint8Array.of(type | 25, length >> 8, length & 0xff);
  }
  return Uint8Array.of(
    type | 26,
    (length >>> 24) & 0xff,
    (length >> 16) & 0xff,
    (length >> 8) & 0xff,
    length & 0xff,
  );
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** Encodes `value` as CBOR (RFC 8949). */
export function encodeCbor(value: CborValue): Uint8Array {
  if (typeof value === "number") {
    if (!Number.isInteger(value)) {
      throw new Error("Only integers are supported");
    }
    return value >= 0 ? head(0, value) : head(1, -1 - value);
  }
  if (value instanceof Uint8Array) {
    return concat([head(2, value.length), value]);
  }
  if (typeof value === "string") {
    const bytes = new TextEncoder().encode(value);
    return concat([head(3, bytes.length), bytes]);
  }
  const entries = [...value.entries()].flatMap(([k, v]) => [encodeCbor(k), encodeCbor(v)]);
  return concat([head(5, value.size), ...entries]);
}
