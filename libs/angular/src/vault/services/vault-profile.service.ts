import { Injectable, inject } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ProfileResponse } from "@bitwarden/common/models/response/profile.response";

@Injectable({
  providedIn: "root",
})
/**
 * Class to provide profile level details to vault entities without having to call the API each time.
 */
export class VaultProfileService {
  private apiService = inject(ApiService);

  private userId: string | null = null;

  /** Profile creation stored as a string. */
  private profileCreatedDate: string | null = null;

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

  private async fetchAndCacheProfile(): Promise<ProfileResponse> {
    const profile = await this.apiService.getProfile();

    this.userId = profile.id;
    this.profileCreatedDate = profile.creationDate;

    return profile;
  }
}
