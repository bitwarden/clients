import { RotateableKeySet } from "@bitwarden/auth/common";
import { OpaqueSessionId } from "@bitwarden/common/types/guid";

export class RegistrationFinishRequest {
  constructor(
    readonly sessionId: OpaqueSessionId,
    readonly registrationUpload: string,
    readonly keySet: RotateableKeySet,
  ) {}
}
