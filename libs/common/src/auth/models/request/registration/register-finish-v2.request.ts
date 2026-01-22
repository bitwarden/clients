import { EncryptedString } from "../../../../key-management/crypto/models/enc-string";
import {
  MasterPasswordAuthenticationData,
  MasterPasswordUnlockData,
} from "../../../../key-management/master-password/types/master-password.types";
import { KeysRequest } from "../../../../models/request/keys.request";

export class RegisterFinishV2Request {
  constructor(
    public email: string,
    public masterPasswordHint: string,

    public userSymmetricKey: EncryptedString,
    public userAsymmetricKeys: KeysRequest,

    public masterPasswordAuthentication: MasterPasswordAuthenticationData,
    public masterPasswordUnlock: MasterPasswordUnlockData,

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
