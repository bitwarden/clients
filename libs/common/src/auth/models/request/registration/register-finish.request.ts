import { KdfType } from "@bitwarden/key-management";

import { EncryptedString } from "../../../../../../key-management/src/cryptography/domain/enc-string";
import { KeysRequest } from "../../../../models/request/keys.request";

export class RegisterFinishRequest {
  constructor(
    public email: string,

    public masterPasswordHash: string,
    public masterPasswordHint: string,

    public userSymmetricKey: EncryptedString,
    public userAsymmetricKeys: KeysRequest,

    public kdf: KdfType,
    public kdfIterations: number,
    public kdfMemory?: number,
    public kdfParallelism?: number,

    public emailVerificationToken?: string,
    public orgSponsoredFreeFamilyPlanToken?: string,
    public acceptEmergencyAccessInviteToken?: string,
    public acceptEmergencyAccessId?: string,
    public providerInviteToken?: string,
    public providerUserId?: string,

    // Org Invite data (only applies on web)
    public organizationUserId?: string,
    public orgInviteToken?: string,
  ) {}
}
