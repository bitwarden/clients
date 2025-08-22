import { inject, Injectable } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";

import { RotateUserAccountKeysRequest } from "./request/rotate-user-account-keys.request";

@Injectable()
export class UserKeyRotationApiService {
  readonly apiService = inject(ApiService);

  postUserKeyUpdate(request: RotateUserAccountKeysRequest): Promise<any> {
    return this.apiService.send(
      "POST",
      "/accounts/key-management/rotate-user-account-keys",
      request,
      true,
      false,
    );
  }
}
