import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { KdfRequest } from "@bitwarden/common/models/request/kdf.request";

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
