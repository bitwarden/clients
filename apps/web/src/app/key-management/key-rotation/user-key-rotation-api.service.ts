import { inject, Injectable } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";

import { RotateUserAccountKeysRequest } from "./request/rotate-user-account-keys.request";
import { UpdateKeyRequest } from "./request/update-key.request";

@Injectable()
export class UserKeyRotationApiService {
  readonly apiService = inject(ApiService);

  postUserKeyUpdate(request: UpdateKeyRequest): Promise<any> {
    return this.apiService.send("POST", "/accounts/key", request, true, false);
  }

  postUserKeyUpdateV2(request: RotateUserAccountKeysRequest): Promise<any> {
    return this.apiService.send(
      "POST",
      "/accounts/key-management/rotate-user-account-keys",
      request,
      true,
      false,
    );
  }
}
