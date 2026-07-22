import { ApiService } from "../../abstractions/api.service";
import { UserId } from "../../types/guid";
import { PasskeyDirectoryEntryResponse } from "../models/response/passkey-directory-entry.response";

import { PasskeyDirectoryApiService } from "./abstractions/passkey-directory-api.service";

export class DefaultPasskeyDirectoryApiService implements PasskeyDirectoryApiService {
  constructor(private apiService: ApiService) {}

  async getPasskeyDirectory(userId: UserId): Promise<PasskeyDirectoryEntryResponse[]> {
    const r: any[] = await this.apiService.send(
      "GET",
      "/reports/passkey-directory",
      null,
      userId,
      true,
    );
    return r.map((entry: any) => new PasskeyDirectoryEntryResponse(entry));
  }
}
