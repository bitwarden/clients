import { RpcRequestChannel } from "./client";
import { RpcError } from "./error";
import { ReferenceId, PropertySymbol, RunCommand, serializeSymbol } from "./protocol";

export type BatchingProxy<T> = {
  [ProxyInfo]: T & {
    proxyType: "RpcObjectReference" | "RpcPendingObjectReference";
  };
};

export const ProxyInfo = Symbol("ProxyInfo");

export function isProxy(obj: any): obj is BatchingProxy<any> {
  return obj && typeof obj === "function" && obj[ProxyInfo] !== undefined;
}

export function isReferenceProxy(obj: any): obj is BatchingProxy<RpcObjectReference> {
  return isProxy(obj) && obj[ProxyInfo].proxyType === "RpcObjectReference";
}

export function isPendingReferenceProxy(obj: any): obj is BatchingProxy<RpcPendingObjectReference> {
  return isProxy(obj) && obj[ProxyInfo].proxyType === "RpcPendingObjectReference";
}

/**
 * A reference to a remote object.
 */
export type RpcObjectReference = {
  referenceId: ReferenceId;
  objectType?: string;
};

export function RpcObjectReference(channel: RpcRequestChannel, reference: RpcObjectReference) {
  const target = () => {};
  Object.defineProperty(target, "name", { value: `RpcObjectReference`, configurable: true });
  (target as any)[ProxyInfo] = { ...reference, proxyType: "RpcObjectReference" };

  return new Proxy(
    target,
    proxyHandler(target, channel, reference, []),
  ) as any as BatchingProxy<RpcObjectReference>;
}

/**
 * A pending reference to a remote object.
 */
export type RpcPendingObjectReference = {
  reference: RpcObjectReference;
  commands: RunCommand[];
};

export function RpcPendingObjectReference(
  channel: RpcRequestChannel,
  reference: RpcPendingObjectReference,
) {
  const target = () => {};
  Object.defineProperty(target, "name", {
    value: `RpcPendingObjectReference(${reference.reference.objectType}.${commandsToString(reference.commands)})`,
    configurable: true,
  });
  (target as any)[ProxyInfo] = { ...reference, proxyType: "RpcPendingObjectReference" };

  return new Proxy(
    target,
    proxyHandler(target, channel, reference.reference, reference.commands),
  ) as any as BatchingProxy<RpcPendingObjectReference>;
}

function proxyHandler(
  target: any,
  channel: RpcRequestChannel,
  reference: RpcObjectReference,
  commands: RunCommand[],
): any {
  return {
    get(target: any, property: string | PropertySymbol) {
      if ((property as any) === ProxyInfo) {
        return (target as any)[ProxyInfo];
      }

      if (property === "then" && commands.length === 0) {
        // This means we awaited a RpcObjectReference which resolves to itself
        // We don't support transfering references to Promises themselves, we'll
        // automatically await them before returning
        return undefined;
      }

      if (property === "then" && commands.length > 0) {
        return run(channel, reference.referenceId, commands);
      }

      if (property === "await") {
        return RpcPendingObjectReference(channel, {
          reference,
          commands: [...commands, { method: "await" }],
        });
      }

      if (property === "transfer") {
        return RpcPendingObjectReference(channel, {
          reference,
          commands: [...commands, { method: "transfer" }],
        });
      }

      return RpcPendingObjectReference(channel, {
        reference,
        commands:
          typeof property === "string"
            ? [...commands, { method: "get", propertyName: property }]
            : [...commands, { method: "get", propertySymbol: serializeSymbol(property) }],
      });
    },

    apply(_target: any, _thisArg: any, argArray?: any): any {
      return RpcPendingObjectReference(channel, {
        reference,
        commands: [...commands, { method: "apply", args: argArray }],
      });
    },
  } satisfies ProxyHandler<any>;
}

function run(
  channel: RpcRequestChannel,
  referenceId: ReferenceId,
  commands: RunCommand[],
): (onFulfilled: (value: any) => void, onRejected: (reason: any) => void) => void {
  const command = {
    method: "run",
    referenceId,
    commands: commands.filter((cmd) => cmd.method !== "await"),
  } as const;

  return (onFulfilled, onRejected) => {
    (async () => {
      const result = await channel.sendCommand(command);

      if (result === null || result === undefined) {
        throw new RpcError("RPC returned null or undefined response");
      }

      if (result.status === "error") {
        throw result.error;
      }

      if (result.result.type === "value") {
        return result.result.value;
      }

      return RpcObjectReference(channel, {
        referenceId: result.result.referenceId,
        objectType: result.result.objectType,
      });
    })().then(onFulfilled, onRejected);
  };
}

function commandsToString(commands: RunCommand[]): string {
  return commands
    .map((cmd) => {
      if (cmd.method === "get") {
        const prop = (cmd as any).propertyName ?? (cmd as any).propertySymbol;
        return `${String(prop)}`;
      } else if (cmd.method === "apply") {
        const prop = (cmd as any).propertyName ?? (cmd as any).propertySymbol;
        return `${String(prop)}()`;
      }

      return "???";
    })
    .join(".");
}
