import { Injectable, inject } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ProfileResponse } from "@bitwarden/common/models/response/profile.response";

@Injectable({
  providedIn: "root",
})
/** Class to provide profile level details without having to call the API each time.  */
export class VaultProfileService {
  private apiService = inject(ApiService);

  private profileId: string | null = null;

  /** Profile creation stored as a string. */
  private profileCreatedDate: string | null = null;

  /** True when 2FA is enabled on the profile. */
  private profile2FAEnabled: boolean | null = null;

  /**
   * Returns the creation date of the profile.
   * Note: `Date`s are mutable in JS, creating a new
   * instance is important to avoid unwanted changes.
   */
  async getProfileCreationDate(): Promise<Date> {
    if (this.profileCreatedDate) {
      return Promise.resolve(new Date(this.profileCreatedDate));
    }

    const profile = await this.fetchAndCacheProfile();

    return new Date(profile.creationDate);
  }

  /**
   * Returns whether there is a 2FA provider on the profile.
   */
  async getProfileTwoFactorEnabled(): Promise<boolean> {
    if (this.profile2FAEnabled !== null) {
      return Promise.resolve(this.profile2FAEnabled);
    }

    const profile = await this.fetchAndCacheProfile();

    return profile.twoFactorEnabled;
  }

  private async fetchAndCacheProfile(): Promise<ProfileResponse> {
    const profile = await this.apiService.getProfile();

    this.profileId = profile.id;
    this.profileCreatedDate = profile.creationDate;
    this.profile2FAEnabled = profile.twoFactorEnabled;

    return profile;
  }
}
