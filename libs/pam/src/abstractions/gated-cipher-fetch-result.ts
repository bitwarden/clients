import { CipherResponse } from "@bitwarden/common/vault/models/response/cipher.response";

import { AccessRequestDetailsResponse } from "./responses/access-request-details.response";

export type GatedCipherFetchResult =
  | { kind: "approved"; cipher: CipherResponse; leaseId: string | null }
  | { kind: "pending"; request: AccessRequestDetailsResponse }
  // The caller already holds an approved-but-not-yet-activated request for this
  // cipher; opening offers to activate the lease rather than creating a
  // duplicate request (CipherOpenAwaitingActivation).
  | { kind: "awaiting_activation"; request: AccessRequestDetailsResponse }
  | { kind: "denied"; reason: string };
