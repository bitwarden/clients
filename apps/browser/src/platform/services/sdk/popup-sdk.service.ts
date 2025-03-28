import { from, map, Observable } from "rxjs";

import { Rc } from "@bitwarden/common/platform/misc/reference-counting/rc";
import { DefaultSdkService } from "@bitwarden/common/platform/services/sdk/default-sdk.service";
import { UserId } from "@bitwarden/common/types/guid";
import { BitwardenClient } from "@bitwarden/sdk-internal";

import { createRemoteSdkClient } from "./remote-ipc-sdk-proxy";

export class PopupSdkService extends DefaultSdkService {
  userClient$(userId: UserId): Observable<Rc<BitwardenClient> | undefined> {
    return from(createRemoteSdkClient(userId)).pipe(map((client) => new Rc(client)));
  }

  setClient(userId: UserId, client: BitwardenClient | undefined): void {
    throw new Error("Method not implemented.");
  }
}
