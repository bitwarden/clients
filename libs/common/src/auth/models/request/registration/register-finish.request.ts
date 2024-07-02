import { KeysRequest } from "../../../../models/request/keys.request";
import { KdfType } from "../../../../platform/enums";
import { EncryptedString } from "../../../../platform/models/domain/enc-string";

export class RegisterFinishRequest {
  constructor(
    public email: string,
    public emailVerificationToken: string,

    public masterPasswordHash: string,
    public masterPasswordHint: string,

    public userSymmetricKey: EncryptedString,
    public userAsymmetricKeys: KeysRequest,

    public kdf: KdfType,
    public kdfIterations: number,
    public kdfMemory?: number,
    public kdfParallelism?: number,

    // Org Invite data (only applies on web)
    public organizationUserId?: string,
    public orgInviteToken?: string,
  ) {}
}
