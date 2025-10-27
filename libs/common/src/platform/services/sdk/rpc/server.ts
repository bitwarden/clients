import { map, Observable, ReplaySubject } from "rxjs";

import { Command, Response, Result } from "./protocol";
import { ReferenceStore } from "./reference-store";

export class RpcServer<T> {
  private references = new ReferenceStore();
  private _value$ = new ReplaySubject<T>(1);
  readonly value$: Observable<Result> = this._value$.pipe(
    map((value) => {
      const referenceId = this.references.store(value);
      return { type: "reference", referenceId, objectType: value?.constructor?.name };
    }),
  );

  constructor() {}

  async handle(command: Command): Promise<Response> {
    if (command.method === "get") {
      const target = this.references.get<any>(command.referenceId);
      if (!target) {
        return { status: "error", error: `[RPC] Reference ID ${command.referenceId} not found` };
      }

      try {
        const propertyValue = target[command.propertyName];
        if (typeof propertyValue === "function") {
          return { status: "error", error: `[RPC] Property ${command.propertyName} is a function` };
        } else {
          return { status: "success", result: this.convertToReturnable(propertyValue) };
        }
      } catch (error) {
        return { status: "error", error };
      }
    }

    if (command.method === "call") {
      const target = this.references.get<any>(command.referenceId);
      if (!target) {
        return { status: "error", error: `[RPC] Reference ID ${command.referenceId} not found` };
      }

      try {
        const method = target[command.propertyName];
        if (typeof method !== "function") {
          return {
            status: "error",
            error: `[RPC] Property ${command.propertyName} is not a function`,
          };
        }

        const result = await method.apply(target, command.args);
        return { status: "success", result: this.convertToReturnable(result) };
      } catch (error) {
        return { status: "error", error };
      }
    }

    return { status: "error", error: `Unknown command method: ${command.method}` };
  }

  setValue(value: T) {
    this._value$.next(value);
  }

  private convertToReturnable(value: any): Result {
    // Return a reference for objects with a 'free' method, otherwise return the value directly
    // This causes objects in WASM memory to be referenced rather than serialized.
    // TODO: Consider checking for 'ptr' instead
    if (isSerializable(value)) {
      return { type: "value", value };
    }

    const referenceId = this.references.store(value);
    return { type: "reference", referenceId, objectType: value?.constructor?.name };
  }
}

function isSerializable(value: any): boolean {
  // Primitives are serializable
  if (value === null || ["string", "number", "boolean"].includes(typeof value)) {
    return true;
  }

  // Arrays are serializable if all elements are
  if (Array.isArray(value)) {
    return value.every(isSerializable);
  }

  // Only plain objects (object literals) are serializable. Class instances should be returned by reference.
  if (isPlainObject(value)) {
    return Object.values(value).every(isSerializable);
  }

  // Everything else (functions, dates, maps, sets, class instances, etc.) should be referenced
  return false;
}

function isPlainObject(value: any): boolean {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
