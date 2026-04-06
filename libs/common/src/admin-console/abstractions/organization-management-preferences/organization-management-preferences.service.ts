// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Observable } from "rxjs";

/**
 * Manages the state of a single organization management preference.
 * Can be used to subscribe to or update a given property.
 */
export class OrganizationManagementPreference<T> {
  state$: Observable<T>;
  set: (value: T) => Promise<void>;

  constructor(state$: Observable<T>, setFn: (value: T) => Promise<void>) {
    this.state$ = state$;
    this.set = setFn;
  }
}

/**
 * Publishes state of a given user's personal settings relating to the user experience of managing an organization.
 */
export abstract class OrganizationManagementPreferencesService {
  autoConfirmFingerPrints: OrganizationManagementPreference<boolean>;
}
