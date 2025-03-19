import { OpaqueSessionId } from "@bitwarden/common/types/guid";

export class LoginFinishRequest {
  constructor(
    readonly sessionId: OpaqueSessionId,
    readonly credentialFinalization: string,
  ) {}
}
