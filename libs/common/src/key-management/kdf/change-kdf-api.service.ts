import { ApiService } from "../../abstractions/api.service";
import { ChangeKdfRequest } from "../../models/request/change-kdf.request";

import { ChangeKdfApiService } from "./change-kdf-api.service.abstraction";

/**
 * @internal
 */
export class DefaultChangeKdfApiService implements ChangeKdfApiService {
  constructor(private apiService: ApiService) {}

  async updateUserKdfParams(request: ChangeKdfRequest): Promise<void> {
    return this.apiService.send("POST", "/accounts/kdf", request, true, false);
  }
}
