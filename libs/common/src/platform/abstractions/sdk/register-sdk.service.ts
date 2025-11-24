import { Observable } from "rxjs";

import { BitwardenClient, Uuid } from "@bitwarden/sdk-internal";

import { UserId } from "../../../types/guid";
import { Rc } from "../../misc/reference-counting/rc";
import { Utils } from "../../misc/utils";

export class UserNotLoggedInError extends Error {
  constructor(userId: UserId) {
    super(`User (${userId}) is not logged in`);
  }
}

export class InvalidUuid extends Error {
  constructor(uuid: string) {
    super(`Invalid UUID: ${uuid}`);
  }
}

/**
 * Converts a string to UUID. Will throw an error if the UUID is non valid.
 */
export function asUuid<T extends Uuid>(uuid: string): T {
  if (Utils.isGuid(uuid)) {
    return uuid as T;
  }

  throw new InvalidUuid(uuid);
}

/**
 * Converts a UUID to the string representation.
 */
export function uuidAsString<T extends Uuid>(uuid: T): string {
  return uuid as unknown as string;
}

export abstract class RegisterSdkService {
  /**
   * Retrieve a client with tokens for a specific user.
   * This client is meant exclusively for registrations that require tokens, such as TDE and key-connector.
   *
   *   - If the user is not logged when the subscription is created, the observable will complete
   *     immediately with {@link UserNotLoggedInError}.
   *   - If the user is logged in, the observable will emit the client and complete whithout an error
   *     when the user logs out.
   *
   * **WARNING:** Do not use `firstValueFrom(userClient$)`! Any operations on the client must be done within the observable.
   * The client will be destroyed when the observable is no longer subscribed to.
   * Please let platform know if you need a client that is not destroyed when the observable is no longer subscribed to.
   *
   * @param userId The user id for which to retrieve the client
   */
  abstract registerClient(userId: UserId): Observable<Rc<BitwardenClient>>;
}
