import { CipherResponse } from "@bitwarden/common/vault/models/response/cipher.response";

import { LeaseRequestResponse } from "./responses/lease-request.response";

export type GatedCipherFetchResult =
  | { kind: "approved"; cipher: CipherResponse; leaseId: string | null }
  | { kind: "pending"; request: LeaseRequestResponse }
  | { kind: "denied"; reason: string };
