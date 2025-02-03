// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { OrganizationUserResetPasswordWithIdRequest } from "@bitwarden/admin-console/common";
import { WebauthnRotateCredentialRequest } from "@bitwarden/common/auth/models/request/webauthn-rotate-credential.request";
// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { SendWithIdRequest } from "@bitwarden/common/src/tools/send/models/request/send-with-id.request";
// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { CipherWithIdRequest } from "@bitwarden/common/src/vault/models/request/cipher-with-id.request";
// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { FolderWithIdRequest } from "@bitwarden/common/src/vault/models/request/folder-with-id.request";

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
}
