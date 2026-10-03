import { X509Certificate, createHash } from "node:crypto";

import { MtlsConfiguration, MtlsErrorCode } from "../../models/mtls";

import { normalizeChallengeEndpoint } from "./endpoint";

export interface OfferedIdentity {
  data: string;
}

export type SelectionResult<T> =
  { certificate: T; error?: never } | { certificate?: never; error?: MtlsErrorCode };

/** Selection policy for Electron's offered certificates. It never invents a key. */
export function selectOfferedIdentity<T extends OfferedIdentity>(
  configuration: MtlsConfiguration,
  challengeUrl: string,
  offered: readonly T[],
  now = new Date(),
): SelectionResult<T> {
  let endpoint: string;
  try {
    endpoint = normalizeChallengeEndpoint(challengeUrl);
  } catch {
    return { error: "invalid-endpoint" };
  }
  const fingerprint = configuration.bindings[endpoint];
  if (!fingerprint) {
    return {};
  }
  const identity = configuration.identities[fingerprint];
  if (!identity) {
    return { error: "identity-missing" };
  }
  const notBefore = new Date(identity.notBefore).getTime();
  const notAfter = new Date(identity.notAfter).getTime();
  if (now.getTime() < notBefore) {
    return { error: "certificate-not-yet-valid" };
  }
  if (now.getTime() > notAfter) {
    return { error: "certificate-expired" };
  }
  for (const certificate of offered) {
    try {
      const der = new X509Certificate(certificate.data).raw;
      if (createHash("sha256").update(der).digest("hex") === fingerprint) {
        return { certificate };
      }
    } catch {
      // A malformed offered certificate cannot become a selected identity.
    }
  }
  return { error: "identity-not-offered" };
}
