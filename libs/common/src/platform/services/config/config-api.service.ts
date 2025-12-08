import { ApiService } from "../../../abstractions/api.service";
import { UserId } from "../../../types/guid";
import { ConfigApiServiceAbstraction } from "../../abstractions/config/config-api.service.abstraction";
import { ServerConfigResponse } from "../../models/response/server-config.response";

export class ConfigApiService implements ConfigApiServiceAbstraction {
  constructor(private apiService: ApiService) {}

  async get(userId: UserId | null): Promise<ServerConfigResponse> {
    // Authentication adds extra context to config responses, if the user has an access token, we want to use it
    // We don't particularly care about ensuring the token is valid and not expired, just that it exists
    let r: any;
    if (userId == null) {
      r = await this.apiService.send("GET", "/config", null, false, true);
    } else {
      r = await this.apiService.send("GET", "/config", null, userId, true);
    }

    return new ServerConfigResponse(r);
  }
}
