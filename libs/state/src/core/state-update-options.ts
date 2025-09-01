// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Observable } from "rxjs";

export type StateUpdateOptions<T, TCombine> = {
  readonly shouldUpdate: (state: T, dependency: TCombine) => boolean;
  readonly combineLatestWith: Observable<TCombine> | null;
  readonly msTimeout: number;
};
