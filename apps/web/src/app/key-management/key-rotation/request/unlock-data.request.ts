import { OrganizationUserResetPasswordWithIdRequest } from "@bitwarden/admin-console/common";
import { DeviceKeysUpdateRequest } from "@bitwarden/common/auth/models/request/update-devices-trust.request";
import { WebauthnRotateCredentialRequest } from "@bitwarden/common/auth/models/request/webauthn-rotate-credential.request";

import { EmergencyAccessWithIdRequest } from "../../../auth/emergency-access/request/emergency-access-update.request";

import { MasterPasswordUnlockDataRequest } from "./master-password-unlock-data.request";

export class UnlockDataRequest {
  // All methods to get to the userkey
  masterPasswordUnlockData: MasterPasswordUnlockDataRequest;
  emergencyAccessUnlockData: EmergencyAccessWithIdRequest[];
  organizationAccountRecoveryUnlockData: OrganizationUserResetPasswordWithIdRequest[];
  passkeyUnlockData: WebauthnRotateCredentialRequest[];
  deviceKeyUnlockData: DeviceKeysUpdateRequest[];

  constructor(
    masterPasswordUnlockData: MasterPasswordUnlockDataRequest,
    emergencyAccessUnlockData: EmergencyAccessWithIdRequest[],
    organizationAccountRecoveryUnlockData: OrganizationUserResetPasswordWithIdRequest[],
    passkeyUnlockData: WebauthnRotateCredentialRequest[],
    deviceTrustUnlockData: DeviceKeysUpdateRequest[],
  ) {
    this.masterPasswordUnlockData = masterPasswordUnlockData;
    this.emergencyAccessUnlockData = emergencyAccessUnlockData;
    this.organizationAccountRecoveryUnlockData = organizationAccountRecoveryUnlockData;
    this.passkeyUnlockData = passkeyUnlockData;
    this.deviceKeyUnlockData = deviceTrustUnlockData;
  }
}
