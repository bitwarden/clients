import { UserId } from "@bitwarden/common/types/guid";

import { ApiService } from "../../../abstractions/api.service";
import { PublicKeysResponseModel } from "../response/public-keys.response";

import { KeyApiService } from "./abstractions/key-api-service.abstraction";

export class DefaultKeyApiService implements KeyApiService {
  constructor(private apiService: ApiService) {}

  async getUserPublicKeys(id: UserId): Promise<PublicKeysResponseModel> {
    const response = await this.apiService.send("GET", "/users/" + id + "/keys", null, true, true);
    return new PublicKeysResponseModel(response);
  }
}
