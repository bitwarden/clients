import {
  BehaviorSubject,
  combineLatest,
  distinctUntilChanged,
  map,
  Observable,
  shareReplay,
} from "rxjs";

import { WithConstraints } from "@bitwarden/common/tools/types";
import {
  GeneratorConstraints,
  PasswordGenerationOptions,
  PasswordGeneratorSettings,
  policies,
} from "@bitwarden/generator-core";

/** The part of stored or transient settings that the settings form uses. */
export type SettingsSubject = Observable<PasswordGeneratorSettings> & {
  readonly withConstraints$: Observable<WithConstraints<PasswordGeneratorSettings>>;
  next(value: PasswordGeneratorSettings): void;
};

/** Password settings held in memory only. Like stored settings, it emits them with policy applied. */
export class TransientPasswordSettings
  extends Observable<PasswordGeneratorSettings>
  implements SettingsSubject
{
  private readonly state: BehaviorSubject<PasswordGenerationOptions>;

  readonly withConstraints$: Observable<WithConstraints<PasswordGeneratorSettings>>;

  constructor(
    settings: PasswordGenerationOptions,
    constraints$: Observable<GeneratorConstraints<PasswordGeneratorSettings>>,
  ) {
    const state = new BehaviorSubject(settings);
    const withConstraints$ = combineLatest([state, constraints$]).pipe(
      map(([s, constraints]) => policies.constrain(constraints, s)),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    super((subscriber) =>
      withConstraints$
        .pipe(
          map(({ state }) => state),
          distinctUntilChanged(),
        )
        .subscribe(subscriber),
    );
    this.state = state;
    this.withConstraints$ = withConstraints$;
  }

  /** The settings before policy applies. */
  get value(): PasswordGenerationOptions {
    return this.state.value;
  }

  /** Replaces the settings like stored settings do, but keeps the website's characters,
   *  which the form has no control for.
   */
  next(value: PasswordGeneratorSettings) {
    const { customRequiredChars, customAllowedChars, maxConsecutive } = this.state.value;
    this.state.next({ ...value, customRequiredChars, customAllowedChars, maxConsecutive });
  }
}
