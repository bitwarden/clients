import { Observable, filter, map } from "rxjs";

import {
  SingleUserStateProvider,
  USER_DECRYPTION_OPTIONS_DISK,
  UserKeyDefinition,
} from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";

import { InternalUserDecryptionOptionsServiceAbstraction } from "../../abstractions/user-decryption-options.service.abstraction";
import { UserDecryptionOptions } from "../../models";

export const USER_DECRYPTION_OPTIONS = new UserKeyDefinition<UserDecryptionOptions>(
  USER_DECRYPTION_OPTIONS_DISK,
  "decryptionOptions",
  {
    deserializer: (decryptionOptions) => UserDecryptionOptions.fromJSON(decryptionOptions),
    clearOn: ["logout"],
  },
);

export class UserDecryptionOptionsService implements InternalUserDecryptionOptionsServiceAbstraction {
  constructor(private singleUserStateProvider: SingleUserStateProvider) {}

  userDecryptionOptionsById$(userId: UserId): Observable<UserDecryptionOptions> {
    return this.singleUserStateProvider
      .get(userId, USER_DECRYPTION_OPTIONS)
      .state$.pipe(filter((options): options is UserDecryptionOptions => options != null));
  }

  hasMasterPasswordById$(userId: UserId): Observable<boolean> {
    return this.userDecryptionOptionsById$(userId).pipe(
      map((options) => options.hasMasterPassword ?? false),
    );
  }

  async setUserDecryptionOptionsById(
    userId: UserId,
    userDecryptionOptions: UserDecryptionOptions,
  ): Promise<void> {
    await this.singleUserStateProvider
      .get(userId, USER_DECRYPTION_OPTIONS)
      .update((_) => userDecryptionOptions);
  }
}
