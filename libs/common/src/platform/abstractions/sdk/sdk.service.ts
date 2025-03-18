import { Observable } from "rxjs";

import { BitwardenClient } from "@bitwarden/sdk-internal";

import { UserId } from "../../../types/guid";
import { Rc } from "../../misc/reference-counting/rc";

export class UserNotLoggedInError extends Error {
  constructor(userId: UserId) {
    super(`User (${userId}) is not logged in`);
  }
}

export abstract class SdkService {
  /**
   * Retrieve the version of the SDK.
   */
  abstract version$: Observable<string>;

  /**
   * Retrieve a client initialized without a user.
   * This client can only be used for operations that don't require a user context.
   */
  abstract client$: Observable<BitwardenClient>;

  /**
   * Retrieve a client initialized for a specific user.
   * This client can be used for operations that require a user context, such as retrieving ciphers
   * and operations involving crypto. It can also be used for operations that don't require a user context.
   *
   * **WARNING:** Do not use `firstValueFrom(userClient$)`! Any operations on the client must be done within the observable.
   * The client will be destroyed when the observable is no longer subscribed to.
   * Please let platform know if you need a client that is not destroyed when the observable is no longer subscribed to.
   *
   * @param userId The user id for which to retrieve the client
   *
   * @throws {UserNotLoggedInError} If the user is not logged in
   */
  abstract userClient$(userId: UserId): Observable<Rc<BitwardenClient> | undefined>;

  /**
   * This method is used during/after an authentication procedure to set a new client for a specific user.
   * It can also be used to unset the client when a user logs out, this will result in:
   *  - The client being disposed of
   *  - All subscriptions to the client being completed
   *  - Any new subscribers receiving an error
   * @param userId The user id for which to set the client
   * @param client The client to set for the user. If undefined, the client will be unset.
   */
  abstract setClient(userId: UserId, client: BitwardenClient | undefined): void;
}
