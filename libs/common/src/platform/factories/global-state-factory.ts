// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { GlobalState } from "../models/domain/global-state";

export class GlobalStateFactory<T extends GlobalState = GlobalState> {
  private globalStateConstructor: new (init: Partial<T>) => T;

  constructor(globalStateConstructor: new (init: Partial<T>) => T) {
    this.globalStateConstructor = globalStateConstructor;
  }

  create(args?: Partial<T>) {
    return new this.globalStateConstructor(args);
  }
}
