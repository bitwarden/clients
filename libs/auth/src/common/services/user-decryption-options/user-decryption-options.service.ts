// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Observable, map } from "rxjs";

import {
  ActiveUserState,
  StateProvider,
  USER_DECRYPTION_OPTIONS_DISK,
  UserKeyDefinition,
} from "@bitwarden/common/platform/state";
// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { UserId } from "@bitwarden/common/src/types/guid";

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

export class UserDecryptionOptionsService
  implements InternalUserDecryptionOptionsServiceAbstraction
{
  private userDecryptionOptionsState: ActiveUserState<UserDecryptionOptions>;

  userDecryptionOptions$: Observable<UserDecryptionOptions>;
  hasMasterPassword$: Observable<boolean>;

  constructor(private stateProvider: StateProvider) {
    this.userDecryptionOptionsState = this.stateProvider.getActive(USER_DECRYPTION_OPTIONS);

    this.userDecryptionOptions$ = this.userDecryptionOptionsState.state$;
    this.hasMasterPassword$ = this.userDecryptionOptions$.pipe(
      map((options) => options?.hasMasterPassword ?? false),
    );
  }

  userDecryptionOptionsById$(userId: UserId): Observable<UserDecryptionOptions> {
    return this.stateProvider.getUser(userId, USER_DECRYPTION_OPTIONS).state$;
  }

  async setUserDecryptionOptions(userDecryptionOptions: UserDecryptionOptions): Promise<void> {
    await this.userDecryptionOptionsState.update((_) => userDecryptionOptions);
  }
}
