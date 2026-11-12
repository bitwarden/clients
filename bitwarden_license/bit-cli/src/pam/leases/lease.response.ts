import { LeaseExtensionResult } from "@bitwarden/bit-common/pam/leases";
import { sdkIdToString } from "@bitwarden/bit-common/pam/shared";
import type { AccessLeaseView } from "@bitwarden/sdk-internal";

import { isoDate, PamObject, PamResponse } from "../shared";

/** A lease, as ids, a state and timestamps. Never a reason, a termination note or a secret. */
export class LeaseResponse extends PamResponse {
  id: string;
  requestId: string;
  cipherId: string;
  collectionId: string;
  organizationId?: string;
  status: string;
  notBefore?: string;
  notAfter?: string;
  /** Present only with `--names`, and only to stdout. */
  cipherName?: string;

  constructor(lease: AccessLeaseView, cipherName?: string) {
    super(PamObject.Lease);
    this.id = sdkIdToString(lease.id);
    this.requestId = sdkIdToString(lease.requestId);
    this.cipherId = sdkIdToString(lease.cipherId);
    this.collectionId = sdkIdToString(lease.collectionId);
    this.organizationId =
      lease.organizationId == null ? undefined : sdkIdToString(lease.organizationId);
    this.status = lease.status;
    this.notBefore = isoDate(lease.notBefore);
    this.notAfter = isoDate(lease.notAfter);
    this.cipherName = cipherName;
  }
}

/** The outcome of a mutating lease verb: ids and a state only. */
export class LeaseChangeResponse extends PamResponse {
  leaseId: string;
  status: string;
  requestId?: string;
  notAfter?: string;

  constructor(leaseId: string, status: string, extension?: LeaseExtensionResult) {
    super(PamObject.Lease);
    this.leaseId = leaseId;
    this.status = status;
    this.requestId = extension?.requestId;
    this.notAfter = isoDate(extension?.notAfter);
  }
}
