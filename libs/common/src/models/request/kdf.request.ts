import { SecretVerificationRequest } from "@bitwarden/common/auth/models/request/secret-verification.request";
import {
  MasterPasswordAuthenticationData,
  MasterPasswordUnlockData,
} from "@bitwarden/common/key-management/master-password/types/master-password.types";

export class KdfRequest extends SecretVerificationRequest {
  constructor(
    readonly authenticationData: MasterPasswordAuthenticationData,
    readonly unlockData: MasterPasswordUnlockData,
  ) {
    super();
  }
}
