import { map, Observable, of, switchMap } from "rxjs";

import { BitwardenClient } from "@bitwarden/sdk-internal";

import { AccountService } from "../../../auth/abstractions/account.service";
import { AuthService } from "../../../auth/abstractions/auth.service";
import { AuthenticationStatus } from "../../../auth/enums/authentication-status";
import { SdkService } from "../../abstractions/sdk/sdk.service";
import { Rc } from "../../misc/reference-counting/rc";

import { RemoteSdkService } from "./remote-sdk.service";
import { RpcClient, RpcRequestChannel } from "./rpc/client";
import { Command, Response } from "./rpc/protocol";
import { RpcServer } from "./rpc/server";

/**
 * A LocalRemoteSdkService is an implementation of RemoteSdkService
 * that forwards calls to the local SDK service. That way the
 * consumers of RemoteSdkService can remain agnostic of whether
 * they are using a local or remote SDK.
 */
export class LocalRemoteSdkService implements RemoteSdkService {
  private server: RpcServer<Rc<BitwardenClient> | null>;
  private client: RpcClient<Rc<BitwardenClient> | null>;

  constructor(
    private sdkService: SdkService,
    private accountService: AccountService,
    private authService: AuthService,
  ) {
    this.server = new RpcServer<Rc<BitwardenClient> | null>();
    this.client = new RpcClient<Rc<BitwardenClient> | null>(new InMemoryChannel(this.server));

    // TODO: This is hacky because we don't support multiple roots.
    // Needs to be fixed.
    this.accountService.activeAccount$
      .pipe(
        switchMap((account) => {
          if (!account) {
            return of(null);
          }

          return this.authService
            .authStatusFor$(account.id)
            .pipe(map((status) => ({ account, status })));
        }),
        switchMap((accountStatus) => {
          if (accountStatus == null || accountStatus.status !== AuthenticationStatus.Unlocked) {
            return of(null);
          }
          return this.sdkService.userClient$(accountStatus.account.id);
        }),
      )
      .subscribe((client) => {
        this.server.setValue(client);
      });
  }

  get remoteClient$() {
    return this.client.getRoot();
  }
}

class InMemoryChannel<T> implements RpcRequestChannel {
  constructor(private server: RpcServer<T>) {}

  async sendCommand(command: Command): Promise<Response> {
    return await this.server.handle(command);
  }

  subscribeToRoot(): Observable<Response> {
    return this.server.value$.pipe(map((result) => ({ status: "success", result })));
  }
}
