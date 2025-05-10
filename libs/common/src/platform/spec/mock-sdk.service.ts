import {
  BehaviorSubject,
  distinctUntilChanged,
  map,
  Observable,
  takeWhile,
  throwIfEmpty,
} from "rxjs";

import { BitwardenClient } from "@bitwarden/sdk-internal";

import { UserId } from "../../types/guid";
import { SdkService, UserNotLoggedInError } from "../abstractions/sdk/sdk.service";
import { Rc } from "../misc/reference-counting/rc";

import { DeepMockProxy, mockDeep } from "./mock-deep";

export class MockSdkService implements SdkService {
  private userClients$ = new BehaviorSubject<{
    [userId: UserId]: Rc<BitwardenClient> | undefined;
  }>({});

  private _client$ = new BehaviorSubject(mockDeep<BitwardenClient>());
  client$ = this._client$.asObservable();

  version$ = new BehaviorSubject("0.0.1-test").asObservable();

  userClient$(userId: UserId): Observable<Rc<BitwardenClient>> {
    return this.userClients$.pipe(
      takeWhile((clients) => clients[userId] !== undefined, false),
      map((clients) => clients[userId] as Rc<BitwardenClient>),
      distinctUntilChanged(),
      throwIfEmpty(() => new UserNotLoggedInError(userId)),
    );
  }

  setClient(): void {
    throw new Error("Not supported in mock service");
  }

  /**
   * Returns the non-user scoped client mock.
   * This is what is returned by the `client$` observable.
   */
  get client(): DeepMockProxy<BitwardenClient> {
    return this._client$.value;
  }

  readonly simulate = {
    /**
     * Simulates a user login, and returns a user-scoped mock for the user.
     * This will be return by the `userClient$` observable.
     *
     * @param userId The userId to simulate login for.
     * @returns A user-scoped mock for the user.
     */
    userLogin: (userId: UserId) => {
      const client = mockDeep<BitwardenClient>();
      this.userClients$.next({
        ...this.userClients$.getValue(),
        [userId]: new Rc(client),
      });
      return client;
    },

    /**
     * Simulates a user logout, and disposes the user-scoped mock for the user.
     * This will remove the user-scoped mock from the `userClient$` observable.
     *
     * @param userId The userId to simulate logout for.
     */
    userLogout: (userId: UserId) => {
      const clients = this.userClients$.value;
      clients[userId]?.markForDisposal();
      this.userClients$.next({
        ...clients,
        [userId]: undefined,
      });
    },
  };
}
