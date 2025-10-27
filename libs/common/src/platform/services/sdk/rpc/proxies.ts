import { RpcRequestChannel } from "./client";
import { Command, ReferenceId } from "./protocol";

/**
 * A reference to a remote object.
 */
export class RpcObjectReference {
  static create(
    channel: RpcRequestChannel,
    referenceId: ReferenceId,
    objectType?: string,
  ): RpcObjectReference {
    return ProxiedReference(channel, new RpcObjectReference(referenceId, objectType));
  }

  private constructor(
    public referenceId: ReferenceId,
    public objectType?: string,
  ) {}
}

function ProxiedReference(
  channel: RpcRequestChannel,
  reference: RpcObjectReference,
): RpcObjectReference {
  return new Proxy(reference, {
    get(target, propertyName: string) {
      if (propertyName === "then") {
        // Allow awaiting the proxy itself
        return undefined;
      }

      // console.log(`Accessing ${reference.objectType}.${propertyName}`);
      return RpcPropertyReference(channel, { objectReference: target, propertyName });
    },
  });
}

/**
 * A reference to a specific property on a remote object.
 */
type RpcPropertyReference = {
  objectReference: RpcObjectReference;
  propertyName: string;
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
  target.objectReference = reference.objectReference;
  target.propertyName = reference.propertyName;

  return new Proxy(target, {
    get(_target, propertyName: string) {
      // console.log(
      //   `Accessing ${reference.objectReference.objectType}.${reference.propertyName}.${propertyName}`,
      // );

      if (propertyName === "call") {
        return undefined;
      }

      if (propertyName !== "then") {
        throw new Error(`Cannot access property '${propertyName}' on remote proxy synchronously`);
      }

      return (onFulfilled: (value: any) => void, onRejected: (error: any) => void) => {
        (async () => {
          // Handle property access
          const command: Command = {
            method: "get",
            referenceId: reference.objectReference.referenceId,
            propertyName: reference.propertyName,
          };
          // Send the command over the channel
          const result = await channel.sendCommand(command);

          if (result.status === "error") {
            throw new Error(`RPC Error: ${result.error}`);
          }

          if (result.result.type === "value") {
            return result.result.value;
          } else if (result.result.type === "reference") {
            return RpcObjectReference.create(channel, result.result.referenceId);
          }
        })().then(onFulfilled, onRejected);
      };
    },
    apply(_target, _thisArg, argArray: unknown[]) {
      // console.log(`Calling ${reference.objectReference.objectType}.${reference.propertyName}`);

      // Handle method call
      const command: Command = {
        method: "call",
        referenceId: reference.objectReference.referenceId,
        propertyName: reference.propertyName,
        args: argArray,
      };

      return channel.sendCommand(command).then((result) => {
        if (result.status === "error") {
          throw new Error(`RPC Error: ${result.error}`);
        }

        if (result.result.type === "value") {
          return result.result.value;
        } else if (result.result.type === "reference") {
          return RpcObjectReference.create(channel, result.result.referenceId);
        }
      });
    },
  });
}
