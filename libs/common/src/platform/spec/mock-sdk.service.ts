import {
  BehaviorSubject,
  distinctUntilChanged,
  map,
  Observable,
  takeWhile,
  throwIfEmpty,
} from "rxjs";

import { PasswordManagerClient } from "@bitwarden/sdk-internal";

import { UserId } from "../../types/guid";
import {
  SdkEndpointOverrides,
  SdkService,
  UserNotLoggedInError,
} from "../abstractions/sdk/sdk.service";
import { Rc } from "../misc/reference-counting/rc";

import { DeepMockProxy, mockDeep } from "./mock-deep";

export class MockSdkService implements SdkService {
  private userClients$ = new BehaviorSubject<{
    [userId: UserId]: Rc<PasswordManagerClient> | undefined;
  }>({});

  private _client$ = new BehaviorSubject(mockDeep<PasswordManagerClient>());
  client$ = this._client$.asObservable();

  version$ = new BehaviorSubject("0.0.1-test").asObservable();

  userClient$(userId: UserId): Observable<Rc<PasswordManagerClient>> {
    return this.userClients$.pipe(
      takeWhile((clients) => clients[userId] !== undefined, false),
      map((clients) => clients[userId] as Rc<PasswordManagerClient>),
      distinctUntilChanged(),
      throwIfEmpty(() => new UserNotLoggedInError(userId)),
    );
  }

  setClient(): void {
    throw new Error("Not supported in mock service");
  }

  /**
   * Returns the same non-user scoped client mock as `client$`; the mock does not model per-call
   * endpoint overrides. Use {@link ephemeralClientEndpoints} to assert on what was requested.
   */
  createEphemeralClient(endpoints: SdkEndpointOverrides): Promise<PasswordManagerClient> {
    this.ephemeralClientEndpoints.push(endpoints);
    return Promise.resolve(this._client$.value);
  }

  /** Endpoint overrides passed to {@link createEphemeralClient}, in call order. */
  readonly ephemeralClientEndpoints: SdkEndpointOverrides[] = [];

  /**
   * Returns the non-user scoped client mock.
   * This is what is returned by the `client$` observable.
   */
  get client(): DeepMockProxy<PasswordManagerClient> {
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
      const client = mockDeep<PasswordManagerClient>();
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
