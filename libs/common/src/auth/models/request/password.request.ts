import {
  MasterPasswordAuthenticationData,
  MasterPasswordUnlockData,
} from "../../../key-management/master-password/types/master-password.types";

import { SecretVerificationRequest } from "./secret-verification.request";

export class PasswordRequest extends SecretVerificationRequest {
  constructor(
    readonly authenticationData: MasterPasswordAuthenticationData,
    readonly unlockData: MasterPasswordUnlockData,
    readonly masterPasswordHint: string,
  ) {
    super();
  }
}
