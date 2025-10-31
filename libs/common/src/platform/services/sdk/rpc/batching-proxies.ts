import { RpcRequestChannel } from "./client";
import { ReferenceId, PropertySymbol, BatchCommand, serializeSymbol } from "./protocol";

export type BatchingProxy<T> = {
  [ProxyInfo]: T & {
    proxyType: "RpcObjectReference" | "RpcPendingObjectReference";
  };
};

export const ProxyInfo = Symbol("ProxyInfo");

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
  commands: BatchCommand[];
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
  commands: BatchCommand[],
): any {
  return {
    get(target: any, property: string | PropertySymbol) {
      if ((property as any) === ProxyInfo) {
        return (target as any)[ProxyInfo];
      }

      if (property === "then") {
        // Allow awaiting the proxy itself
        return undefined;
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

function commandsToString(commands: BatchCommand[]): string {
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
