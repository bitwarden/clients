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

  handle(command: Command): Response {
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
          return { status: "success", result: { type: "value", value: propertyValue } };
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

        const result = method.apply(target, command.args);
        return { status: "success", result: { type: "value", value: result } };
      } catch (error) {
        return { status: "error", error };
      }
    }

    return { status: "error", error: `Unknown command method: ${command.method}` };
  }

  setValue(value: T) {
    this._value$.next(value);
  }
}
