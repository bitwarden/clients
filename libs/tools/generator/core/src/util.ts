// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { BehaviorSubject, Observable } from "rxjs";

import {
  SingleUserState,
  StateProvider,
  UserKeyDefinition,
} from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";

import {
  DefaultPassphraseBoundaries,
  DefaultPassphraseGenerationOptions,
  DefaultPasswordGenerationOptions,
} from "./data";
import { PassphraseGenerationOptions, PasswordGenerationOptions } from "./types";

/** construct a method that outputs a copy of `defaultValue` as an observable. */
export function observe$PerUserId<Value>(
  create: () => Partial<Value>,
): (key: UserId) => Observable<Value> {
  const _subjects = new Map<UserId, BehaviorSubject<Value>>();

  return (key: UserId) => {
    let value = _subjects.get(key);

    if (value === undefined) {
      const initialValue = create();
      value = new BehaviorSubject({ ...initialValue } as Value);
      _subjects.set(key, value);
    }

    return value.asObservable();
  };
}

/** construct a method that caches user-specific states by userid. */
export function sharedByUserId<Value>(create: (userId: UserId) => SingleUserState<Value>) {
  const _subjects = new Map<UserId, SingleUserState<Value>>();

  return (key: UserId) => {
    let value = _subjects.get(key);

    if (value === undefined) {
      value = create(key);
      _subjects.set(key, value);
    }

    return value;
  };
}

/** construct a method that loads a user-specific state from the provider. */
export function sharedStateByUserId<Value>(key: UserKeyDefinition<Value>, provider: StateProvider) {
  return (id: UserId) => provider.getUser<Value>(id, key);
}

/** returns the sum of items in the list. */
export const sum = (...items: number[]) =>
  (items ?? []).reduce((sum: number, current: number) => sum + (current ?? 0), 0);

/* converts password generation option sets, which are defined by
 * an "enabled" and "quantity" parameter, to the password engine's
 * parameters, which represent disabled options as `undefined`
 * properties.
 */
export function optionsToRandomAsciiRequest(options: PasswordGenerationOptions) {
  // helper for processing common option sets
  function process(
    // values read from the options
    enabled: boolean,
    quantity: number,
    // value used if an option is missing
    defaultEnabled: boolean,
    defaultQuantity: number,
  ) {
    const isEnabled = enabled ?? defaultEnabled;
    const actualQuantity = quantity ?? defaultQuantity;
    const result = isEnabled ? actualQuantity : undefined;

    return result;
  }

  const request = {
    uppercase: process(
      options.uppercase,
      options.minUppercase,
      DefaultPasswordGenerationOptions.uppercase,
      DefaultPasswordGenerationOptions.minUppercase,
    ),
    lowercase: process(
      options.lowercase,
      options.minLowercase,
      DefaultPasswordGenerationOptions.lowercase,
      DefaultPasswordGenerationOptions.minLowercase,
    ),
    digits: process(
      options.number,
      options.minNumber,
      DefaultPasswordGenerationOptions.number,
      DefaultPasswordGenerationOptions.minNumber,
    ),
    special: process(
      options.special,
      options.minSpecial,
      DefaultPasswordGenerationOptions.special,
      DefaultPasswordGenerationOptions.minSpecial,
    ),
    ambiguous: options.ambiguous ?? DefaultPasswordGenerationOptions.ambiguous!,
    all: 0,
  };

  // engine represents character sets as "include only"; you assert how many all
  // characters there can be rather than a total length. This conversion has
  // the character classes win, so that the result is always consistent with policy
  // minimums.
  const required = sum(request.uppercase, request.lowercase, request.digits, request.special);
  const remaining = (options.length ?? 0) - required;
  request.all = Math.max(remaining, 0);

  return request;
}

/* converts passphrase generation option sets to the eff word list request
 */
export function optionsToEffWordListRequest(options: PassphraseGenerationOptions) {
  const requestWords = options.numWords ?? DefaultPassphraseGenerationOptions.numWords;
  const request = {
    numberOfWords: Math.max(requestWords, DefaultPassphraseBoundaries.numWords.min),
    capitalize: options.capitalize ?? DefaultPassphraseGenerationOptions.capitalize,
    number: options.includeNumber ?? DefaultPassphraseGenerationOptions.includeNumber,
    separator: options.wordSeparator ?? DefaultPassphraseGenerationOptions.wordSeparator,
  };

  return request;
}
