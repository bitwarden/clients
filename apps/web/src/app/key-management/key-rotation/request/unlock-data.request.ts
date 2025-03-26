import { OrganizationUserResetPasswordWithIdRequest } from "@bitwarden/admin-console/common";
import { WebauthnRotateCredentialRequest } from "@bitwarden/common/auth/models/request/webauthn-rotate-credential.request";

import { EmergencyAccessWithIdRequest } from "../../../auth/emergency-access/request/emergency-access-update.request";

import { MasterPasswordUnlockDataRequest } from "./master-password-unlock-data.request";

export class UnlockDataRequest {
  // All methods to get to the userkey
  masterPasswordUnlockData: MasterPasswordUnlockDataRequest;
  emergencyAccessUnlockData: EmergencyAccessWithIdRequest[];
  organizationAccountRecoveryUnlockData: OrganizationUserResetPasswordWithIdRequest[];
  passkeyUnlockData: WebauthnRotateCredentialRequest[];

  constructor(
    masterPasswordUnlockData: MasterPasswordUnlockDataRequest,
    emergencyAccessUnlockData: EmergencyAccessWithIdRequest[],
    organizationAccountRecoveryUnlockData: OrganizationUserResetPasswordWithIdRequest[],
    passkeyUnlockData: WebauthnRotateCredentialRequest[],
  ) {
    this.masterPasswordUnlockData = masterPasswordUnlockData;
    this.emergencyAccessUnlockData = emergencyAccessUnlockData;
    this.organizationAccountRecoveryUnlockData = organizationAccountRecoveryUnlockData;
    this.passkeyUnlockData = passkeyUnlockData;
  }
}
