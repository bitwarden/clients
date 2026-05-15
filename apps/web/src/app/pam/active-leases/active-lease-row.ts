import { LeaseResponse } from "@bitwarden/pam";

/**
 * Display-ready row for the active leases view. Decouples the
 * presentation layer from `LeaseResponse` so name hydration can evolve
 * (or be shared with the approver inbox in PM-37268) without churning
 * the component.
 */
export interface ActiveLeaseRow {
  id: string;
  cipherName: string;
  collectionName: string;
  requesterName: string;
  notBefore: Date;
  notAfter: Date;
  /** Set to true between the user confirming revoke and the row leaving the list. */
  justRevoked?: boolean;
  /**
   * Timestamp the row entered the just-revoked state. Used to drive the
   * transient "Revoked" badge — internal to the active-leases view.
   * @internal
   */
  revokedAt?: Date;
}

/**
 * Pluggable resolver — the page injects an implementation that turns
 * lease IDs into display names. v0 uses an `id-passthrough` resolver
 * while real wiring against CipherService/CollectionService/OrgUserService
 * follows in a parallel story.
 */
export interface LeaseDisplayResolver {
  cipherName(cipherId: string): string;
  collectionName(collectionId: string): string;
  requesterName(userId: string): string;
}

export const idPassthroughResolver: LeaseDisplayResolver = {
  cipherName: (id) => id,
  collectionName: (id) => id,
  requesterName: (id) => id,
};

export function toActiveLeaseRow(
  lease: LeaseResponse,
  resolver: LeaseDisplayResolver,
): ActiveLeaseRow {
  return {
    id: lease.id,
    cipherName: resolver.cipherName(lease.cipherId),
    collectionName: resolver.collectionName(lease.collectionId),
    requesterName: resolver.requesterName(lease.granteeUserId),
    notBefore: new Date(lease.notBefore),
    notAfter: new Date(lease.notAfter),
  };
}
