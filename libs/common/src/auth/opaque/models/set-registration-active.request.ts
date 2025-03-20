import { OpaqueSessionId } from "@bitwarden/common/types/guid";

export class SetRegistrationActiveRequest {
  constructor(readonly sessionId: OpaqueSessionId) {}
}
