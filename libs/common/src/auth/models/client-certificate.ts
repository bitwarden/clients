/** Public certificate-management contract shared by desktop IPC and Angular. */
export type ClientCertificateError =
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
  | "store-password-unsupported"
  | "secret-store-unavailable"
  | "secret-store-locked"
  | "store-location-unsupported"
  | "store-corrupt"
  | "storage-failed"
  | "backend-failed"
  | "conflict";

export type ClientCertificateResult<T> =
  { ok: true; value: T } | { ok: false; error: { code: ClientCertificateError } };

export interface ClientCertificateIdentity {
  fingerprint: string;
  label: string;
  subject: string;
  issuer: string;
  notBefore: string;
  notAfter: string;
  importedAt: string;
}

export interface ClientCertificateView {
  revision: number;
  identities: Record<string, ClientCertificateIdentity>;
  bindings: Record<string, string>;
  activeBindings: Record<string, string>;
  cleanup: string[];
  restartRequired: boolean;
}

export interface ClientCertificateStatus {
  state: "ready" | "restart-pending" | "unavailable";
  error?: ClientCertificateError;
}

export type ClientCertificateChange = { revision: number; restartRequired: true };
