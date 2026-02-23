// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Fido2Utils } from "./fido2-utils";
import { guidToRawFormat } from "./guid-utils";

export function parseCredentialId(encodedCredentialId: string): ArrayBuffer {
  try {
    if (encodedCredentialId.startsWith("b64.")) {
      const buffer = Fido2Utils.stringToBuffer(encodedCredentialId.slice(4));
      return buffer.byteLength === 0 ? undefined : buffer;
    }

    return guidToRawFormat(encodedCredentialId).buffer;
  } catch {
    return undefined;
  }
}

/**
 * Compares two credential IDs for equality.
 */
export function compareCredentialIds(a: ArrayBuffer, b: ArrayBuffer): boolean {
  if (a == null || b == null || a.byteLength !== b.byteLength) {
    return false;
  }

  const viewA = new Uint8Array(a);
  const viewB = new Uint8Array(b);

  for (let i = 0; i < viewA.length; i++) {
    if (viewA[i] !== viewB[i]) {
      return false;
    }
  }

  return true;
}
