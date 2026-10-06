import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";

import { OpenShellEndpoint } from "../models/openshell";

/**
 * The §M8.5 canonical string for a policy digest: one line per endpoint,
 * `host \t port \t path \t source \n` (an absent path is the empty string), sorted by UTF-8 byte
 * order and concatenated. aac computes the same string, so the renderer can recompute the digest
 * over exactly the endpoint list it is about to show.
 */
export function openShellPolicyCanonicalBytes(endpoints: readonly OpenShellEndpoint[]): Uint8Array {
  const encoder = new TextEncoder();
  const lines = endpoints.map((endpoint) =>
    encoder.encode(
      `${endpoint.host}\t${endpoint.port}\t${endpoint.path ?? ""}\t${endpoint.source}\n`,
    ),
  );
  lines.sort(compareBytes);
  const total = lines.reduce((sum, line) => sum + line.length, 0);
  const canonical = new Uint8Array(total);
  let offset = 0;
  for (const line of lines) {
    canonical.set(line, offset);
    offset += line.length;
  }
  return canonical;
}

/** Lexicographic byte order — what "sort the lines by byte order" means in §M8.5. JS string
 *  comparison is UTF-16 code-unit order, which differs for some non-ASCII paths. */
function compareBytes(a: Uint8Array, b: Uint8Array): number {
  const shared = Math.min(a.length, b.length);
  for (let i = 0; i < shared; i++) {
    if (a[i] !== b[i]) {
      return a[i] - b[i];
    }
  }
  return a.length - b.length;
}

/**
 * Recomputes the §M8.5 policy digest (`"sha256:" + lowercase hex`). This is a fingerprint of the
 * displayed endpoint list, not new encryption logic: it only binds what the user sees to what aac
 * reported, so a mismatch can be refused before any dialog opens.
 */
export async function computeOpenShellPolicyDigest(
  cryptoFunctionService: CryptoFunctionService,
  endpoints: readonly OpenShellEndpoint[],
): Promise<string> {
  const hash = await cryptoFunctionService.hash(openShellPolicyCanonicalBytes(endpoints), "sha256");
  const hex = Array.from(hash, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `sha256:${hex}`;
}
