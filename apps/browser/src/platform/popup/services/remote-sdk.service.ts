import { filter, map, shareReplay } from "rxjs";

import { Rc } from "@bitwarden/common/platform/misc/reference-counting/rc";
import { RemoteSdkService } from "@bitwarden/common/platform/services/sdk/remote-sdk.service";
import { RpcClient } from "@bitwarden/common/platform/services/sdk/rpc/client";
import { Response } from "@bitwarden/common/platform/services/sdk/rpc/protocol";
import { BitwardenClient } from "@bitwarden/sdk-internal";

import { LogService } from "../../../../../../libs/logging/src";
import { BrowserApi } from "../../browser/browser-api";
import {
  isRemoteSdkRoot,
  RemoteSdkRequest,
  RemoteSdkResendRootRequest,
} from "../../services/sdk/messages";

const root$ = BrowserApi.messageListener$().pipe(
  // tap((message) => console.log("RemoteSdkService: Received message", message)),
  filter(isRemoteSdkRoot),
  map((message) => message.result),
  shareReplay({ bufferSize: 1, refCount: false }),
);

export class BrowserRemoteSdkService implements RemoteSdkService {
  private client = new RpcClient<Rc<BitwardenClient>>({
    subscribeToRoot: () => {
      void BrowserApi.sendMessage("sdk.request", {
        type: "RemoteSdkResendRootRequest",
      } satisfies RemoteSdkResendRootRequest);
      return root$.pipe(
        map((result) => ({
          status: "success",
          result,
        })),
      );
    },
    sendCommand: async (command) => {
      this.logService.debug("[RemoteSdkService]: Sending command", command);
      const response = (await BrowserApi.sendMessageWithResponse("sdk.request", {
        type: "RemoteSdkRequest",
        command,
      } satisfies RemoteSdkRequest)) as Response;
      this.logService.debug("[RemoteSdkService]: Received response", response);
      return response;
    },
  });

  constructor(private logService: LogService) {
    // Eagerly subscribe to the remote client to make sure we catch the value.
    // Also a hack, the server should send the value on request.
    this.remoteClient$.subscribe();
  }

  get remoteClient$() {
    return this.client.getRoot();
  }
}
