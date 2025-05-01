import { OrganizationUserResetPasswordWithIdRequest } from "@bitwarden/admin-console/common";
import { WebauthnRotateCredentialRequest } from "@bitwarden/common/auth/models/request/webauthn-rotate-credential.request";
import { SendWithIdRequest } from "@bitwarden/common/tools/send/models/request/send-with-id.request";
import { CipherWithIdRequest } from "@bitwarden/common/vault/models/request/cipher-with-id.request";
import { FolderWithIdRequest } from "@bitwarden/common/vault/models/request/folder-with-id.request";

import { EmergencyAccessWithIdRequest } from "../../../auth/emergency-access/request/emergency-access-update.request";

export class UpdateKeyRequest {
  masterPasswordHash: string;
  key: string;
  privateKey: string;
  ciphers: CipherWithIdRequest[] = [];
  folders: FolderWithIdRequest[] = [];
  sends: SendWithIdRequest[] = [];
  emergencyAccessKeys: EmergencyAccessWithIdRequest[] = [];
  resetPasswordKeys: OrganizationUserResetPasswordWithIdRequest[] = [];
  webauthnKeys: WebauthnRotateCredentialRequest[] = [];

  constructor(masterPasswordHash: string, key: string, privateKey: string) {
    this.masterPasswordHash = masterPasswordHash;
    this.key = key;
    this.privateKey = privateKey;
  }
}
