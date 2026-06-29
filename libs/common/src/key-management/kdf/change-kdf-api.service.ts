import { ApiService } from "../../abstractions/api.service";
import { KdfRequest } from "../../models/request/kdf.request";

import { ChangeKdfApiService } from "./change-kdf-api.service.abstraction";

/**
 * @internal
 */
export class DefaultChangeKdfApiService implements ChangeKdfApiService {
  constructor(private apiService: ApiService) {}

  async updateUserKdfParams(request: KdfRequest): Promise<void> {
    return this.apiService.send("POST", "/accounts/kdf", request, true, false);
  }
}
