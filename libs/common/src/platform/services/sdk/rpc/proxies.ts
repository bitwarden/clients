import { chain } from "../chainable-promise";

import { RpcRequestChannel } from "./client";
import { Command, PropertySymbol, ReferenceId, Response, serializeSymbol } from "./protocol";

/**
 * A reference to a remote object.
 */
export class RpcObjectReference {
  static create(
    channel: RpcRequestChannel,
    referenceId: ReferenceId,
    objectType?: string,
  ): RpcObjectReference & { by_value(): Promise<any> } {
    return ProxiedReference(channel, new RpcObjectReference(referenceId, objectType)) as any;
  }

  private constructor(
    public referenceId: ReferenceId,
    public objectType?: string,
  ) {}
}

function ProxiedReference(
  channel: RpcRequestChannel,
  reference: RpcObjectReference,
): RpcObjectReference & { by_value(): Promise<any> } {
  return new Proxy(reference as any, {
    get(target, property: string | PropertySymbol) {
      if (property === "then") {
        // Allow awaiting the proxy itself
        return undefined;
      }

      if (property === "by_value") {
        return async () => {
          const result = await sendAndUnwrap(channel, {
            method: "by_value",
            referenceId: reference.referenceId,
          } as Command);
          if (result.type !== "value") {
            throw new Error(
              `[RPC] by_value() expected a value but got a reference for ${reference.objectType}`,
            );
          }
          return result.value;
        };
      }

      // console.log(`Accessing ${reference.objectType}.${String(propertyName)}`);
      return RpcPropertyReference(channel, { objectReference: target as any, property });
    },
  }) as any;
}

/**
 * A reference to a specific property on a remote object.
 */
type RpcPropertyReference = {
  objectReference: RpcObjectReference;
  property: string | PropertySymbol;
};

/**
 * A reference to a specific property on a remote object.
 */
// export class RpcPropertyReference {
//   static create(
//     channel: RpcRequestChannel,
//     objectReference: RpcObjectReference,
//     propertyName: string,
//   ): RpcPropertyReference {
//     return ProxiedReferenceProperty(
//       channel,
//       new RpcPropertyReference(objectReference, propertyName),
//     );
//   }

//   private constructor(
//     public objectReference: RpcObjectReference,
//     public propertyName: string,
//   ) {}
// }

/**
 * A sub-proxy for a specific property of a proxied reference
 * This is because we need to handle property accesses differently than method calls
 * but we don't know which type it is until it gets consumed.
 *
 * If this references a method then the `apply` trap will be called on this proxy.
 * If this references a property then they'll try to await the value, triggering the `get` trap
 * when they access the `then` property.
 */
function RpcPropertyReference(channel: RpcRequestChannel, reference: RpcPropertyReference) {
  const target = () => {};
  Object.defineProperty(target, "name", { value: `RpcPropertyReference`, configurable: true });
  (target as any).objectReference = reference.objectReference;
  (target as any).property = reference.property;

  return new Proxy(target, {
    get(_target, propertyName: string) {
      // console.log(
      //   `Accessing ${reference.objectReference.objectType}.${reference.propertyName}.${propertyName}`,
      // );

      // Allow Function.prototype.call/apply/bind to be used by TS helpers and wrappers (e.g., disposables, chainable await)
      if (propertyName === "call") {
        return Function.prototype.call;
      }
      if (propertyName === "apply") {
        return Function.prototype.apply;
      }
      if (propertyName === "bind") {
        return Function.prototype.bind;
      }

      if (propertyName !== "then") {
        // Support chained call like: (await obj.prop).method() AND obj.prop.method()
        // by lazily resolving obj.prop first, then invoking method/property on the resolved reference.
        return (...argArray: unknown[]) => {
          const p = (async () => {
            // First resolve the original referenced property value via GET
            const getResult = await sendAndUnwrap(channel, buildGetCommand(reference));
            if (getResult.type !== "reference") {
              throw new Error(
                `Cannot access property '${propertyName}' on non-reference value returned by remote property`,
              );
            }

            // Now perform the requested operation on the resolved reference
            const callResult = await sendAndUnwrap(
              channel,
              buildCallCommand(getResult.referenceId, propertyName, argArray),
            );
            if (callResult.type === "value") {
              return callResult.value;
            }
            return RpcObjectReference.create(
              channel,
              callResult.referenceId,
              callResult.objectType,
            );
          })();
          return chain(p as Promise<any>);
        };
      }

      return (onFulfilled: (value: any) => void, onRejected: (error: any) => void) => {
        (async () => {
          const result = await sendAndUnwrap(channel, buildGetCommand(reference));
          return unwrapResult(channel, result);
        })().then(onFulfilled, onRejected);
      };
    },
    apply(_target, _thisArg, argArray: unknown[]) {
      // console.log(`Calling ${reference.objectReference.objectType}.${reference.propertyName}`);

      const command = buildCallCommand(
        reference.objectReference.referenceId,
        reference.property,
        argArray,
      );
      const p = (async () => {
        const result = await sendAndUnwrap(channel, command);
        if (result.type === "value") {
          return result.value;
        }
        return RpcObjectReference.create(channel, result.referenceId, result.objectType);
      })();
      return chain(p as Promise<any>);
    },
  });
}

// Helpers
function buildGetCommand(reference: RpcPropertyReference): Command {
  if (typeof reference.property === "string") {
    return {
      method: "get",
      referenceId: reference.objectReference.referenceId,
      propertyName: reference.property,
    };
  }
  return {
    method: "get",
    referenceId: reference.objectReference.referenceId,
    propertySymbol: serializeSymbol(reference.property),
  };
}

function buildCallCommand(
  referenceId: ReferenceId,
  property: string | PropertySymbol,
  args: unknown[],
): Command {
  if (typeof property === "string") {
    return { method: "call", referenceId, propertyName: property, args };
  }
  return { method: "call", referenceId, propertySymbol: serializeSymbol(property), args };
}

async function sendAndUnwrap(channel: RpcRequestChannel, command: Command) {
  const response: Response = await channel.sendCommand(command);
  if (response.status === "error") {
    throw new Error(`RPC Error: ${response.error}`);
  }
  return response.result;
}

function unwrapResult(channel: RpcRequestChannel, result: any) {
  if (result.type === "value") {
    return result.value;
  }
  return RpcObjectReference.create(channel, result.referenceId, result.objectType);
}
