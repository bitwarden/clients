import { Injectable, inject } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";

@Injectable({
  providedIn: "root",
})
/** Class to provide profile level details without having to call the API each time.  */
export class VaultProfileService {
  private apiService = inject(ApiService);

  /** Profile creation stored as a string. */
  private profileCreatedDate: string | null = null;

  /**
   * Returns the creation date of the profile.
   * Note: `Date`s are mutable in JS, creating a new
   * instance is important to avoid unwanted changes.
   */
  async getProfileCreationDate(): Promise<Date> {
    if (this.profileCreatedDate) {
      return Promise.resolve(new Date(this.profileCreatedDate));
    }

    const profile = await this.apiService.getProfile();

    this.profileCreatedDate = profile.creationDate;

    return new Date(this.profileCreatedDate);
  }
}
