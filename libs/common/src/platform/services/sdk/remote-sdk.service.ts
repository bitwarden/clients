import { Observable } from "rxjs";

import { BitwardenClient } from "@bitwarden/sdk-internal";

import { Rc } from "../../misc/reference-counting/rc";

import { Remote } from "./rpc/remote";

export abstract class RemoteSdkService {
  abstract remoteClient$: Observable<Remote<Rc<BitwardenClient> | null>>;
}
