import { BehaviorSubject, Observable } from "rxjs";

import { BitwardenClient } from "@bitwarden/sdk-internal";

import { UserId } from "../../../types/guid";
import { SdkService } from "../../abstractions/sdk/sdk.service";
import { Rc } from "../../misc/reference-counting/rc";

import { DeepMockProxy, mockDeep } from "./mock-deep";

export class MockSdkService implements SdkService {
  private _client$ = new BehaviorSubject(mockDeep<BitwardenClient>());
  client$ = this._client$.asObservable();

  version$: Observable<string>;

  userClient$(userId: UserId): Observable<Rc<BitwardenClient> | undefined> {
    throw new Error("Method not implemented.");
  }

  setClient(userId: UserId, client: BitwardenClient | undefined): void {
    throw new Error("Method not implemented.");
  }

  get clientMock(): DeepMockProxy<BitwardenClient> {
    return this._client$.getValue();
  }
}
