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

  get clientMock(): DeepMockProxy<BitwardenClient> {
    return this._client$.value;
  }

  readonly simulate = {
    userLogin: (userId: UserId) => {
      const client = mockDeep<BitwardenClient>();
      this.userClients$.next({
        ...this.userClients$.getValue(),
        [userId]: new Rc(client),
      });
      return client;
    },
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
