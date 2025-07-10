// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Observable } from "rxjs";

export const DEFAULT_OPTIONS = {
  shouldUpdate: () => true,
  combineLatestWith: null as Observable<unknown>,
  msTimeout: 1000,
};

type DefinitelyTypedDefault<T, TCombine> = Omit<
  typeof DEFAULT_OPTIONS,
  "shouldUpdate" | "combineLatestWith"
> & {
  shouldUpdate: (state: T, dependency: TCombine) => boolean;
  combineLatestWith?: Observable<TCombine>;
};

export type StateUpdateOptions<T, TCombine> = Partial<DefinitelyTypedDefault<T, TCombine>>;

export function populateOptionsWithDefault<T, TCombine>(
  options: StateUpdateOptions<T, TCombine>,
): StateUpdateOptions<T, TCombine> {
  return {
    ...(DEFAULT_OPTIONS as StateUpdateOptions<T, TCombine>),
    ...options,
  };
}
