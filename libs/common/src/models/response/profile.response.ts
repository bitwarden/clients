import { PrivateAccountKeysResponseModel } from "@bitwarden/common/key-management/keys/response/private-account-keys.response";

import { ProfileOrganizationResponse } from "../../admin-console/models/response/profile-organization.response";
import { ProfileProviderOrganizationResponse } from "../../admin-console/models/response/profile-provider-organization.response";
import { ProfileProviderResponse } from "../../admin-console/models/response/profile-provider.response";
import { UserId } from "../../types/guid";

import { BaseResponse } from "./base.response";

export class ProfileResponse extends BaseResponse {
  id: UserId;
  name: string;
  email: string;
  emailVerified: boolean;
  premiumPersonally: boolean;
  premiumFromOrganization: boolean;
  culture: string;
  twoFactorEnabled: boolean;
  key: string;
  avatarColor: string;
  creationDate: string;
  // Cleanup: Can be removed after moving to accountKeys
  privateKey: string;
  // Cleanup: This should be non-optional after the server has been released for a while https://bitwarden.atlassian.net/browse/PM-21768
  accountKeys: PrivateAccountKeysResponseModel | null;
  securityStamp: string;
  forcePasswordReset: boolean;
  usesKeyConnector: boolean;
  verifyDevices: boolean;
  organizations: ProfileOrganizationResponse[] = [];
  providers: ProfileProviderResponse[] = [];
  providerOrganizations: ProfileProviderOrganizationResponse[] = [];

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.name = this.getResponseProperty("Name");
    this.email = this.getResponseProperty("Email");
    this.emailVerified = this.getResponseProperty("EmailVerified");
    this.premiumPersonally = this.getResponseProperty("Premium");
    this.premiumFromOrganization = this.getResponseProperty("PremiumFromOrganization");
    this.culture = this.getResponseProperty("Culture");
    this.twoFactorEnabled = this.getResponseProperty("TwoFactorEnabled");
    this.key = this.getResponseProperty("Key");
    // Cleanup: This should be non-optional after the server has been released for a while https://bitwarden.atlassian.net/browse/PM-21768
    if (this.getResponseProperty("AccountKeys") != null) {
      this.accountKeys = new PrivateAccountKeysResponseModel(
        this.getResponseProperty("AccountKeys"),
      );
    }
    this.avatarColor = this.getResponseProperty("AvatarColor");
    this.creationDate = this.getResponseProperty("CreationDate");
    this.privateKey = this.getResponseProperty("PrivateKey");
    this.securityStamp = this.getResponseProperty("SecurityStamp");
    this.forcePasswordReset = this.getResponseProperty("ForcePasswordReset") ?? false;
    this.usesKeyConnector = this.getResponseProperty("UsesKeyConnector") ?? false;
    this.verifyDevices = this.getResponseProperty("VerifyDevices") ?? true;

    const organizations = this.getResponseProperty("Organizations");
    if (organizations != null) {
      this.organizations = organizations.map((o: any) => new ProfileOrganizationResponse(o));
    }
    const providers = this.getResponseProperty("Providers");
    if (providers != null) {
      this.providers = providers.map((o: any) => new ProfileProviderResponse(o));
    }
    const providerOrganizations = this.getResponseProperty("ProviderOrganizations");
    if (providerOrganizations != null) {
      this.providerOrganizations = providerOrganizations.map(
        (o: any) => new ProfileProviderOrganizationResponse(o),
      );
    }
  }
}
