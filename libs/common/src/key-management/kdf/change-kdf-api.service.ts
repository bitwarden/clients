import { ApiService } from "../../abstractions/api.service";

import { ChangeKdfApiService } from "./change-kdf-api.service.abstraction";
import { ChangeKdfRequest } from "./models/change-kdf.request";

/**
 * @internal
 */
export class DefaultChangeKdfApiService implements ChangeKdfApiService {
  constructor(private apiService: ApiService) {}

  async updateUserKdfParams(request: ChangeKdfRequest): Promise<void> {
    return this.apiService.send("POST", "/accounts/kdf", request, true, false);
  }
}
