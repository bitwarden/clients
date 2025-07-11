import { ApiService } from "../../../abstractions/api.service";
import { PublicAccountKeysResponseModel } from "../response/public-account-keys.response";

import { KeyApiService } from "./abstractions/key-api-service.abstraction";

export class DefaultKeyApiService implements KeyApiService {
  constructor(private apiService: ApiService) {}

  async getUserPublicKeys(id: string): Promise<PublicAccountKeysResponseModel> {
    const r = await this.apiService.send("GET", "/users/" + id + "/keys", null, true, true);
    return new PublicAccountKeysResponseModel(r);
  }
}
