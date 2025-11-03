// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Fido2Utils } from "./fido2-utils";
import { guidToRawFormat } from "./guid-utils";

export function parseCredentialId(encodedCredentialId: string): ArrayBuffer {
  try {
    if (encodedCredentialId.startsWith("b64.")) {
      return Fido2Utils.stringToBuffer(encodedCredentialId.slice(4));
    }

    let arr = guidToRawFormat(encodedCredentialId);
    console.log("guidToRawFormat output:", arr)
    return arr.buffer;
  } catch {
    return undefined;
  }
}

/**
 * Compares two credential IDs for equality.
 */
export function compareCredentialIds(a: ArrayBuffer, b: ArrayBuffer): boolean {
  console.log("compareCredentialIds:", a, b)
  if (a.byteLength !== b.byteLength) {
    return false;
  }

  const viewA = new Uint8Array(a);
  const viewB = new Uint8Array(b);
  console.log("Comparing credential IDs:", viewA, viewB)

  for (let i = 0; i < viewA.length; i++) {
    if (viewA[i] !== viewB[i]) {
      return false;
    }
  }

  return true;
}
