import { combineLatest, map, of, startWith, Subject, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { Rc } from "@bitwarden/common/platform/misc/reference-counting/rc";
import { RpcServer } from "@bitwarden/common/platform/services/sdk/rpc/server";
import { BitwardenClient } from "@bitwarden/sdk-internal";

import { BrowserApi } from "../../browser/browser-api";

import { isRemoteSdkRequest, isRemoteSdkResendRootRequest, RemoteSdkRoot } from "./messages";

export class RemoteSdkServerService {
  server = new RpcServer<Rc<BitwardenClient> | null>();

  constructor(
    private accountService: AccountService,
    private authService: AuthService,
    private sdkService: SdkService,
  ) {}

  init() {
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

    const resendRequest$ = new Subject<void>();

    combineLatest({
      root: this.server.value$,
      resendRequest: resendRequest$.pipe(startWith(null)),
    }).subscribe(({ root }) => {
      void BrowserApi.sendMessage("sdk.root", {
        type: "RemoteSdkRoot",
        result: root,
      } satisfies RemoteSdkRoot);
    });

    BrowserApi.messageListener(
      "sdk.request",
      (message: any, sender: chrome.runtime.MessageSender, sendResponse: any) => {
        if (isRemoteSdkRequest(message)) {
          void this.server.handle(JSON.parse(message.command)).then((response) => {
            sendResponse(JSON.stringify(response));
          });
          return true; // Indicate that we will send a response asynchronously
        }

        if (isRemoteSdkResendRootRequest(message)) {
          resendRequest$.next();
        }
      },
    );
  }
}
