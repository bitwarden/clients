import { Injectable, inject } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationUserType } from "@bitwarden/common/admin-console/enums";
import { ProfileResponse } from "@bitwarden/common/models/response/profile.response";

@Injectable({
  providedIn: "root",
})
/**
 * Class to provide profile level details without having to call the API each time.
 * NOTE: This is a temporary service and can be replaced once the `UnauthenticatedExtensionUIRefresh` flag goes live.
 * The `UnauthenticatedExtensionUIRefresh` introduces a sync that takes place upon logging in. These details can then
 * be added to account object and retrieved from there.
 * TODO: PM-16202
 */
export class VaultProfileService {
  private apiService = inject(ApiService);

  private userId: string | null = null;

  /** Profile creation stored as a string. */
  private profileCreatedDate: string | null = null;

  /** True when 2FA is enabled on the profile. */
  private profile2FAEnabled: boolean | null = null;

  /** True when ssoBound is true for any of the users organizations */
  private userIsSsoBound: boolean | null = null;

  /** True when the user is an admin or owner of the ssoBound organization */
  private userIsSsoBoundAdminOwner: boolean | null = null;

  /**
   * Returns the creation date of the profile.
   * Note: `Date`s are mutable in JS, creating a new
   * instance is important to avoid unwanted changes.
   */
  async getProfileCreationDate(userId: string): Promise<Date> {
    if (this.profileCreatedDate && userId === this.userId) {
      return Promise.resolve(new Date(this.profileCreatedDate));
    }

    const profile = await this.fetchAndCacheProfile();

    return new Date(profile.creationDate);
  }

  /**
   * Returns whether there is a 2FA provider on the profile.
   */
  async getProfileTwoFactorEnabled(userId: string): Promise<boolean> {
    if (this.profile2FAEnabled !== null && userId === this.userId) {
      return Promise.resolve(this.profile2FAEnabled);
    }

    const profile = await this.fetchAndCacheProfile();

    return profile.twoFactorEnabled;
  }

  /**
   * Returns whether the user logs in with SSO for any organization.
   */
  async getUserSSOBound(userId: string): Promise<boolean> {
    if (this.userIsSsoBound !== null && userId === this.userId) {
      return Promise.resolve(this.userIsSsoBound);
    }

    await this.fetchAndCacheProfile();

    return !!this.userIsSsoBound;
  }

  /**
   * Returns true when the user is an Admin or Owner of an organization with `ssoBound` true.
   */
  async getUserSSOBoundAdminOwner(userId: string): Promise<boolean> {
    if (this.userIsSsoBoundAdminOwner !== null && userId === this.userId) {
      return Promise.resolve(this.userIsSsoBoundAdminOwner);
    }

    await this.fetchAndCacheProfile();

    return !!this.userIsSsoBoundAdminOwner;
  }

  private async fetchAndCacheProfile(): Promise<ProfileResponse> {
    const profile = await this.apiService.getProfile();

    this.userId = profile.id;
    this.profileCreatedDate = profile.creationDate;
    this.profile2FAEnabled = profile.twoFactorEnabled;
    const ssoBoundOrg = profile.organizations.find((org) => org.ssoBound);
    this.userIsSsoBound = !!ssoBoundOrg;
    this.userIsSsoBoundAdminOwner =
      ssoBoundOrg?.type === OrganizationUserType.Admin ||
      ssoBoundOrg?.type === OrganizationUserType.Owner;

    return profile;
  }
}
