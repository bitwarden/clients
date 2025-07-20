import { ObservableInput, OperatorFunction, switchMap } from "rxjs";

/**
 * Indicates that the given set of actions is not supported and there is
 * not anything the user can do to make it supported. The reason property
 * should contain a documented and machine readable string so more in
 * depth details can be shown to the user.
 */
export type NotSupported = { type: "not-supported"; reason: string };

/**
 * Indicates that the given set of actions does not currently work but
 * could be supported if configuration, either inside Bitwarden or outside,
 * is done. The reason property should contain a documented and
 * machine readable string so further instruction can be supplied to the caller.
 */
export type NeedsConfiguration = { type: "needs-configuration"; reason: string };

/**
 * Indicates that the actions in the service property are supported.
 */
export type Supported<T> = { type: "supported"; service: T };

/**
 * A type encapsulating the status of support for a service.
 */
export type SupportStatus<T> = Supported<T> | NeedsConfiguration | NotSupported;

/**
 * Projects each source value to one of the given projects defined in `selectors`.
 *
 * @param selectors.supported The function to run when the given item reports that it is supported
 * @param selectors.notSupported The function to run when the given item reports that it is either not-supported
 *   or needs-configuration.
 * @returns A function that returns an Observable that emits the result of one of the given projection functions.
 */
export function supportSwitch<TService, TSupported, TNotSupported>(selectors: {
  supported: (service: TService, index: number) => ObservableInput<TSupported>;
  notSupported: (reason: string, index: number) => ObservableInput<TNotSupported>;
}): OperatorFunction<SupportStatus<TService>, TSupported | TNotSupported> {
  return switchMap((supportStatus, index) => {
    if (supportStatus.type === "supported") {
      return selectors.supported(supportStatus.service, index);
    }

    return selectors.notSupported(supportStatus.reason, index);
  });
}
