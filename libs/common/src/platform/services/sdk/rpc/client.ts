import { map, Observable } from "rxjs";

import { Remote } from "../remote";

import { RpcObjectReference } from "./batch-proxies";
import { Command, Response } from "./protocol";

export interface RpcRequestChannel {
  sendCommand(command: Command): Promise<Response>;
  subscribeToRoot(): Observable<Response>;
}

export class RpcClient<T> {
  constructor(private channel: RpcRequestChannel) {}

  getRoot(): Observable<Remote<T>> {
    return this.channel.subscribeToRoot().pipe(
      map((response) => {
        if (response.status === "error") {
          throw new Error(`RPC Error: ${response.error}`);
        }

        if (response.result.type !== "reference") {
          throw new Error(`Expected reference result for root object`);
        }

        return RpcObjectReference(this.channel, {
          referenceId: response.result.referenceId,
          objectType: response.result.objectType,
        }) as any as Remote<T>;
      }),
    );
  }
}
