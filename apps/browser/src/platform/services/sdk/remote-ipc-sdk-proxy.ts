import { firstValueFrom } from "rxjs";
import { v4 } from "uuid";

import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  SdkService,
  UserNotLoggedInError,
} from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { UserId } from "@bitwarden/common/types/guid";
import { BitwardenClient, SUB_CLIENT_METHODS } from "@bitwarden/sdk-internal";

type Arg = { type: string; value: string };

const REMOTE_IPC_PORT_NAME = "remote-ipc-sdk";

// The Proxy code is fairly reusable, so hide the actual IPC implementation behind a class
// that can be replaced with a different implementation if needed.
class RemoteSdkIpc {
  private port: chrome.runtime.Port;

  constructor(port: chrome.runtime.Port) {
    this.port = port;
  }

  close(): void {
    this.port.disconnect();
  }

  send(channel: string, msg: any): void {
    this.port.postMessage({ channel, value: msg });
  }

  // Listen for messages. If the listener returns true, it is unsubscribed
  on(listener: (channel: string, msg: any) => boolean): void {
    const listenerWrapper = (msg: any) => {
      if (listener(msg.channel, msg.value)) {
        this.port.onMessage.removeListener(listenerWrapper);
      }
    };
    this.port.onMessage.addListener(listenerWrapper);
  }

  // Send a message and expect a response
  invoke(channel: string, msg: any): Promise<any> {
    const responsePromise = this.receive(channel);
    this.send(channel, msg);
    return responsePromise;
  }

  // Listen for a single message
  receive(channel: string): Promise<any> {
    return new Promise((resolve) => {
      const listener = (ch: string, msg: any) => {
        if (ch === channel) {
          resolve(msg);
          return true;
        }
        return false;
      };
      this.on(listener);
    });
  }
}

// Start listening for remote SDK requests. This should be called in the background script.
export function startRemoteIpcSdkListener(sdkService: SdkService, logService: LogService) {
  // eslint-disable-next-line no-restricted-syntax
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== REMOTE_IPC_PORT_NAME) {
      return;
    }

    void handleRemoteSdkRequest(sdkService, logService, new RemoteSdkIpc(port)).finally(() => {
      port.disconnect();
    });
  });
}

async function handleRemoteSdkRequest(
  sdkService: SdkService,
  logService: LogService,
  ipc: RemoteSdkIpc,
) {
  const request = await ipc.receive("request");
  const { userId, subclients, func, args } = request as {
    userId: UserId;
    subclients: string[];
    func: string;
    args: Arg[];
  };

  const sdkLocalRc = await firstValueFrom(sdkService.userClient$(userId));
  if (!sdkLocalRc) {
    ipc.send("response", errorToIpcMessage(new UserNotLoggedInError(userId)));
    return;
  }
  using sdkLocalRcRef = sdkLocalRc.take();
  const sdkLocal = sdkLocalRcRef.value;

  // Go through all the clients and subclients
  let client = sdkLocal as any;
  for (const sc of subclients) {
    if (!(sc in client)) {
      ipc.send("response", errorToIpcMessage(new Error(`Subclient ${sc} not found`)));
      return;
    }
    client = client[sc]();
  }

  // Process the arguments so they can't be sent through IPC
  const argObjects = args.map((arg, index) => {
    // If the argument is a function we need to create a special channel for it, as they can't be serialized.
    // Instead, the channel id will be passed as the value to the function.
    if (arg.type === "function") {
      return async (...callbackArgs: any[]) => {
        const channel = v4();
        // This is the promise that we send to the SDK client, every time the function is called
        // we send the data through IPC and wait for a response, which will resolve or reject the promise.
        return new Promise((resolve, reject) => {
          const responsePromise = ipc.invoke(channel, {
            type: "callback",
            value: { index, callbackArgs },
          });
          responsePromise
            .then((response) => resolveIpcMessage(response, resolve, reject))
            .catch(reject);
        });
      };
    }
    // For all other arguments, assume they can be serialized as-is
    return arg.value;
  });

  // Call the function on the SDK client and send the response back
  const message = await resultToIpcMessage(() => client[func](...argObjects));
  ipc.send("response", message);
}

// Create a new remote SDK client. This client will be a proxy that will send requests to the background script
export async function createRemoteSdkClient(userId: UserId): Promise<BitwardenClient> {
  return new Proxy({} as BitwardenClient, remoteSdkClientHandler(userId, [])) as BitwardenClient;
}

function remoteSdkClientHandler(userId: UserId, subclients: string[]): ProxyHandler<any> {
  return {
    get: function (_: any, prop: string, receiver: any) {
      // Go through all the clients and check if prop exists at the end,
      // which indicates we should return a Proxy subclient
      let client = SUB_CLIENT_METHODS;
      for (const sc of subclients) {
        client = client[sc];
      }
      if (prop in client) {
        return () => new Proxy({}, remoteSdkClientHandler(userId, [...subclients, prop]));
      }

      return (...args: any[]) => {
        const ipc = new RemoteSdkIpc(chrome.runtime.connect({ name: REMOTE_IPC_PORT_NAME }));

        // Serialize the arguments to JSON strings to be sent through IPC.
        // Functions can't be sent through IPC so we will send a special message
        // to the other side to handle them.
        const argsJson = args.map((a) =>
          typeof a === "function" ? { type: "function" } : { type: "json", value: a },
        );

        return new Promise((resolve, reject) => {
          ipc.on((channel: string, msg: any) => {
            const { type, value } = msg;

            // If the message is a callback request, call the function at index with
            // the provided arguments, and send the result back through IPC
            if (type === "callback") {
              const { index, callbackArgs } = value;
              const func = args[+index];
              void resultToIpcMessage(() => func(...callbackArgs)).then((message: any) =>
                ipc.send(channel, message),
              );
              // Received a response, resolve the promise and close the port
            } else {
              resolveIpcMessage(msg, resolve, reject);
              ipc.close();
              return true;
            }
            return false;
          });

          // Send the request message
          ipc.send("request", {
            userId,
            subclients,
            func: prop,
            args: argsJson,
          });
        });
      };
    },

    // Return false to prevent setting properties on the proxy
    set: function (_: any, prop: string, value: any, receiver: any) {
      return false;
    },

    // TODO: Do we need to handle apply? We can probably delegate to get()
    apply: function (_: any, thisArg: any, argArray: any) {
      return undefined;
    },
  };
}

async function resultToIpcMessage(func: () => any) {
  try {
    const value = await func();
    return { type: "ok", value };
  } catch (e) {
    return errorToIpcMessage(e);
  }
}

function errorToIpcMessage(error: Error) {
  return {
    type: "error",
    value: {
      message: error.message,
      stack: error.stack,
      name: error.name,
    },
  };
}

function resolveIpcMessage(
  message: any,
  resolve: (value: any) => void,
  reject: (error: Error) => void,
) {
  if (message.type === "ok") {
    resolve(message.value);
  } else {
    const err = new Error(message.value.message);
    err.stack = message.value.stack;
    err.name = message.value.name;
    reject(err);
  }
}
