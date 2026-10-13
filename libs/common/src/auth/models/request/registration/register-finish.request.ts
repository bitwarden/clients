import {
  MasterPasswordAuthenticationData,
  MasterPasswordUnlockData,
} from "../../../../key-management/master-password/types/master-password.types";
import { KeysRequest } from "../../../../models/request/keys.request";

import { OpenOrgInviteRequest } from "./open-org-invite.request";

export class RegisterFinishRequest {
  constructor(
    public email: string,
    public masterPasswordHint: string,

    public userAsymmetricKeys: KeysRequest,

    public masterPasswordAuthentication: MasterPasswordAuthenticationData,
    public masterPasswordUnlock: MasterPasswordUnlockData,

    public emailVerificationToken?: string,
    public orgSponsoredFreeFamilyPlanToken?: string,
    public acceptEmergencyAccessInviteToken?: string,
    public acceptEmergencyAccessId?: string,
    public providerInviteToken?: string,
    public providerUserId?: string,

    public salesAssistedToken?: string,

    // Direct Org Invite data (only applies on web)
    public organizationUserId?: string,
    public orgInviteToken?: string,

    // Open-org-invite data (only applies on web).
    public openOrgInvite?: OpenOrgInviteRequest,
  ) {}
}
