import { ApiService } from "../../../abstractions/api.service";

import { UserPreferencesRequest } from "./user-preferences.request";
import { UserPreferencesResponse } from "./user-preferences.response";

export class PreferenceSyncApiService {
  constructor(private apiService: ApiService) {}

  async getUserPreferences(): Promise<UserPreferencesResponse | null> {
    const r = await this.apiService.send("GET", "/user-preferences", null, true, true);
    if (r == null) {
      return null;
    }
    return new UserPreferencesResponse(r);
  }

  async putUserPreferences(request: UserPreferencesRequest): Promise<void> {
    await this.apiService.send("PUT", "/user-preferences", request, true, false);
  }
}
