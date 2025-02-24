import { v4 as uuidv4 } from "uuid";

import * as sdk from "@bitwarden/sdk-internal";
import { BitwardenClient } from "@bitwarden/sdk-internal";

const SUBCLIENTS = {
  crypto: {},
  vault: {
    totp: {},
    folders: {},
  },
};

// Dummy IPC implementation for testing
const ipc = {
  subscribers: {} as Record<string, (from: string, message: string) => void>,
  send: async (channel: string, from: string, message: string) => {
    if (channel in ipc.subscribers) {
      ipc.subscribers[channel](from, message);
    }
  },
  subscribe: (channel: string, func: (from: string, message: string) => void) => {
    ipc.subscribers[channel] = func;
  },
  clear: (channel: string) => {
    delete ipc.subscribers[channel];
  },
};
type IPC = typeof ipc;

function sdkIpcHandler(
  // TODO: We may need to pass a userId or sdkId here to identify the sdkClient to use on the other side?
  // userId: UserId,
  subclients: string[],
  ipc: IPC,
): ProxyHandler<any> {
  return {
    get: function (_: any, prop: string, receiver: any) {
      // Go through all the clients and check if prop exists at the end,
      // which indicates we should return a Proxy subclient
      let client = SUBCLIENTS as any;
      for (const sc of subclients) {
        client = client[sc];
      }
      if (prop in client) {
        return () => new Proxy({}, sdkIpcHandler([...subclients, prop], ipc));
      }

      return async (...funcArgs: any[]) => {
        const id = uuidv4();

        // Serialize the arguments to JSON strings to be sent through IPC.
        // Functions can't be sent through IPC so we generate a channel name that we will subscribe to.
        const argsJson = funcArgs.map((a, idx) => {
          if (typeof a === "function") {
            return { type: "function", value: `${id}-callback-${idx}` };
          }
          return { type: "json", value: a };
        });

        return new Promise((resolve, reject) => {
          // Listen for a response from the other side
          ipc.subscribe(id, (from: string, message: string) => {
            const { type, value } = JSON.parse(message);

            if (type === "result") {
              ipc.clear(id);
              resolve(value);
            } else if (type === "error") {
              ipc.clear(id);
              const err = new Error(value.message);
              err.stack = value.stack;
              err.name = value.name;
              reject(err);
            } else {
              // This is a callback function
              const func = funcArgs[+type];
              const channel = argsJson[+type].value;
              func(...value)
                .then((result: any) => {
                  return ipc.send(channel, id, JSON.stringify({ type: "result", value: result }));
                })
                .catch((e: any) => {
                  const err = { message: e.message, stack: e.stack, name: e.name };
                  return ipc.send(channel, id, JSON.stringify({ type: "error", value: err }));
                });
            }
          });

          // Send the message
          const message = {
            subclients,
            func: prop,
            args: argsJson,
          };
          void ipc.send("sdk", id, JSON.stringify(message));
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

type Arg = { type: string; value: string };

/* eslint-disable no-console */
export async function testProxy() {
  // Create local sdk client
  const sdkLocal = new sdk.BitwardenClient();

  // Subscribe the local SDK client to the sdk channel
  ipc.subscribe("sdk", async (from: string, message: string) => {
    const { subclients, func, args } = JSON.parse(message) as {
      subclients: string[];
      func: string;
      args: Arg[];
    };

    // Go through all the clients and subclients
    let client = sdkLocal as any;
    for (const sc of subclients) {
      if (!(sc in client)) {
        throw new Error(`Subclient ${sc} not found`);
      }
      client = client[sc]();
    }

    // Process the arguments so they can't be sent through IPC
    const argObjects = args.map((a, idx) => {
      // If the argument is a function we need to create a special channel for it, as they can't be serialized.
      // Instead, the channel id will be passed as the value to the function.
      if (a.type === "function") {
        return async (...args: any[]) => {
          // This is the promise that we send to the SDK client, every time the function is called
          // we send the data through IPC and wait for a response, which will resolve or reject the promise.
          return new Promise((resolve, reject) => {
            ipc.subscribe(a.value, (_from: string, message: string) => {
              ipc.clear(a.value);
              const { type, value } = JSON.parse(message);
              if (type === "result") {
                resolve(value);
              } else {
                const err = new Error(value.message);
                err.stack = value.stack;
                err.name = value.name;
                reject(err);
              }
            });

            ipc.send(from, "sdk", JSON.stringify({ type: idx, value: args })).catch((e) => {
              ipc.clear(a.value);
              reject(e);
            });
          });
        };
      }
      // For all other arguments, assume they can be serialized as-is
      return a.value;
    });

    // Call the function on the SDK client and send the response back
    try {
      const value = await client[func](...argObjects);
      await ipc.send(from, "sdk", JSON.stringify({ type: "result", value }));
    } catch (e) {
      const err = { message: e.message, stack: e.stack, name: e.name };
      await ipc.send(from, "sdk", JSON.stringify({ type: "error", value: err }));
    }

    // Function finished, clear callback channels
    for (let i = 0; i < args.length; i++) {
      if (args[i].type === "function") {
        ipc.clear(args[i].value);
      }
    }
  });

  const sdkIpc = new Proxy({} as BitwardenClient, sdkIpcHandler([], ipc)) as BitwardenClient;

  const ver1 = sdkLocal.version();
  const ver2 = await sdkIpc.version();
  console.log("############ sdk.version()", ver1, ver2, ver1 === ver2);

  const echo1 = sdkLocal.echo("Hello, World!");
  const echo2 = await sdkIpc.echo("Hello, World!");
  console.log("############ sdkIpc.echo()", echo1, echo2, echo1 === echo2);

  const cr_echo1 = await sdkLocal.crypto().async_echo("Hello, World!");
  const cr_echo2 = await sdkIpc.crypto().async_echo("Hello, World!");
  console.log(
    "############ sdkIpc.crypto().async_echo()",
    cr_echo1,
    cr_echo2,
    cr_echo1 === cr_echo2,
  );

  const cb1 = await sdkLocal.async_echo_cb(async (text: string) => {
    return "sdk.async_echo_cb()" + text;
  });
  const cb2 = await sdkIpc.async_echo_cb(async (text: string) => {
    return "sdk.async_echo_cb()" + text;
  });
  console.log("############ sdkIpc.async_echo_cb()", cb1, cb2, cb1 === cb2);
}
