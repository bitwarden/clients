import type { ClientCertificateIdentity as IdentityMetadata } from "@bitwarden/common/auth/models/client-certificate";

export type {
  ClientCertificateIdentity as IdentityMetadata,
  ClientCertificateError as MtlsErrorCode,
  ClientCertificateResult as MtlsResult,
  ClientCertificateStatus as MtlsStatus,
  ClientCertificateView as MtlsView,
} from "@bitwarden/common/auth/models/client-certificate";

export type Fingerprint = string;
export type EndpointKey = string;

export interface MtlsConfiguration {
  version: 1;
  revision: number;
  storeId: string;
  identities: Record<Fingerprint, IdentityMetadata>;
  bindings: Record<EndpointKey, Fingerprint>;
  cleanup: Fingerprint[];
}
