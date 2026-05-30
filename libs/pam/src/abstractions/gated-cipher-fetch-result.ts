import { CipherResponse } from "@bitwarden/common/vault/models/response/cipher.response";

import { AccessRequestResponse } from "./responses/access-request.response";

export type GatedCipherFetchResult =
  | { kind: "approved"; cipher: CipherResponse; leaseId: string | null }
  | { kind: "pending"; request: AccessRequestResponse }
  // The caller already holds an approved-but-unredeemed ticket for this cipher;
  // opening offers to start the lease rather than creating a duplicate request
  // (CipherOpenAwaitingRedemption).
  | { kind: "awaiting_redemption"; request: AccessRequestResponse }
  | { kind: "denied"; reason: string };
