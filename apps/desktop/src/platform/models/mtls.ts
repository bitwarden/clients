export type Fingerprint = string;
export type EndpointKey = string;

export interface IdentityMetadata {
  fingerprint: Fingerprint;
  label: string;
  subject: string;
  issuer: string;
  notBefore: string;
  notAfter: string;
  importedAt: string;
}

export interface MtlsConfiguration {
  version: 1;
  revision: number;
  storeId: string;
  identities: Record<Fingerprint, IdentityMetadata>;
  bindings: Record<EndpointKey, Fingerprint>;
  cleanup: Fingerprint[];
}

export type MtlsErrorCode =
  | "unsupported"
  | "cancelled"
  | "invalid-endpoint"
  | "invalid-file"
  | "invalid-password"
  | "unsupported-bundle"
  | "certificate-expired"
  | "certificate-not-yet-valid"
  | "identity-missing"
  | "identity-not-offered"
  | "secret-store-unavailable"
  | "secret-store-locked"
  | "store-password-unsupported"
  | "store-location-unsupported"
  | "store-corrupt"
  | "storage-failed"
  | "backend-failed"
  | "conflict";

export type MtlsResult<T> = { ok: true; value: T } | { ok: false; error: { code: MtlsErrorCode } };

export interface MtlsStatus {
  state: "ready" | "restart-pending" | "unavailable";
  error?: MtlsErrorCode;
}

export interface MtlsView {
  revision: number;
  identities: Record<Fingerprint, IdentityMetadata>;
  bindings: Record<EndpointKey, Fingerprint>;
  activeBindings: Record<EndpointKey, Fingerprint>;
  cleanup: Fingerprint[];
  restartRequired: boolean;
}
