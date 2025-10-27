import { coerceBooleanProperty } from "@angular/cdk/coercion";
import {
  OnInit,
  Input,
  Output,
  EventEmitter,
  Component,
  OnDestroy,
  SimpleChanges,
  OnChanges,
} from "@angular/core";
import { FormBuilder } from "@angular/forms";
import { takeUntil, Subject, map, filter, tap, skip, ReplaySubject, withLatestFrom } from "rxjs";

import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  CredentialGeneratorService,
  PasswordGenerationOptions,
  BuiltIn,
} from "@bitwarden/generator-core";

import { hasRangeOfValues } from "./util";

const Controls = Object.freeze({
  length: "length",
  uppercase: "uppercase",
  lowercase: "lowercase",
  number: "number",
  special: "special",
  minNumber: "minNumber",
  minSpecial: "minSpecial",
  avoidAmbiguous: "avoidAmbiguous",
});

/** Options group for passwords */
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "tools-password-settings",
  templateUrl: "password-settings.component.html",
  standalone: false,
})
export class PasswordSettingsComponent implements OnInit, OnChanges, OnDestroy {
  /** Instantiates the component
   *  @param generatorService settings and policy logic
   *  @param i18nService localize hints
   *  @param formBuilder reactive form controls
   */
  constructor(
    private formBuilder: FormBuilder,
    private generatorService: CredentialGeneratorService,
    private i18nService: I18nService,
  ) {}

  /** Binds the component to a specific user's settings.
   *  @remarks this is initialized to null but since it's a required input it'll
   *     never have that value in practice.
   */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input({ required: true })
  account: Account = null!;

  protected account$ = new ReplaySubject<Account>(1);

  async ngOnChanges(changes: SimpleChanges) {
    if ("account" in changes && changes.account) {
      this.account$.next(this.account);
    }
  }

  /** When `true`, an options header is displayed by the component. Otherwise, the header is hidden. */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input()
  showHeader: boolean = true;

  /** Number of milliseconds to wait before accepting user input. */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input()
  waitMs: number = 100;

  /** Removes bottom margin from `bit-section` */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input({ transform: coerceBooleanProperty }) disableMargin = false;

  /** Emits settings updates and completes if the settings become unavailable.
   * @remarks this does not emit the initial settings. If you would like
   *   to receive live settings updates including the initial update,
   *   use `CredentialGeneratorService.settings(...)` instead.
   */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output()
  readonly onUpdated = new EventEmitter<PasswordGenerationOptions>();

  protected settings = this.formBuilder.group({
    [Controls.length]: [0],
    [Controls.uppercase]: [false],
    [Controls.lowercase]: [false],
    [Controls.number]: [false],
    [Controls.special]: [false],
    [Controls.minNumber]: [0],
    [Controls.minSpecial]: [0],
    [Controls.avoidAmbiguous]: [false],
  });

  private get numbers() {
    return this.settings.get(Controls.number)!;
  }

  private get special() {
    return this.settings.get(Controls.special)!;
  }

  private get minNumber() {
    return this.settings.get(Controls.minNumber)!;
  }

  private get minSpecial() {
    return this.settings.get(Controls.minSpecial)!;
  }

  async ngOnInit() {
    const settings = await this.generatorService.settings(BuiltIn.password, {
      account$: this.account$,
    });

    // bind settings to the UI
    settings.withConstraints$
      .pipe(
        map(({ state, constraints }) => {
          // interface is "avoid" while storage is "include"
          const s: any = { ...state };
          s.avoidAmbiguous = !s.ambiguous;
          delete s.ambiguous;
          return [s, constraints] as const;
        }),
        takeUntil(this.destroyed$),
      )
      .subscribe(([state, constraints]) => {
        let boundariesHint = this.i18nService.t(
          "spinboxBoundariesHint",
          constraints.length?.min?.toString(),
          constraints.length?.max?.toString(),
        );
        if (state.length <= (constraints.length?.recommendation ?? 0)) {
          boundariesHint += this.i18nService.t(
            "passwordLengthRecommendationHint",
            constraints.length?.recommendation?.toString(),
          );
        }
        this.lengthBoundariesHint.next(boundariesHint);

        // skips reactive event emissions to break a subscription cycle
        this.settings.patchValue(state, { emitEvent: false });
      });

    // explain policy & disable policy-overridden fields
    this.generatorService
      .policy$(BuiltIn.password, { account$: this.account$ })
      .pipe(takeUntil(this.destroyed$))
      .subscribe(({ constraints }) => {
        this.policyInEffect = constraints.policyInEffect ?? false;

        const toggles = [
          [Controls.length, hasRangeOfValues(constraints.length?.min, constraints.length?.max)],
          [Controls.uppercase, !constraints.uppercase?.readonly],
          [Controls.lowercase, !constraints.lowercase?.readonly],
          [Controls.number, !constraints.number?.readonly],
          [Controls.special, !constraints.special?.readonly],
          [
            Controls.minNumber,
            hasRangeOfValues(constraints.minNumber?.min, constraints.minNumber?.max),
          ],
          [
            Controls.minSpecial,
            hasRangeOfValues(constraints.minSpecial?.min, constraints.minSpecial?.max),
          ],
        ] as [keyof typeof Controls, boolean][];

        for (const [control, enabled] of toggles) {
          this.toggleEnabled(control, enabled);
        }
      });

    // cascade selections between checkboxes and spinboxes
    // before the group saves their values
    let lastMinNumber = 1;
    this.numbers.valueChanges
      .pipe(
        filter((checked) => !(checked && (this.minNumber.value ?? 0) > 0)),
        map((checked) => (checked ? lastMinNumber : 0)),
        takeUntil(this.destroyed$),
      )
      .subscribe((value) => this.minNumber.setValue(value, { emitEvent: false }));

    this.minNumber.valueChanges
      .pipe(
        map((value) => [value, (value ?? 0) > 0] as const),
        tap(
          ([value, checkNumbers]) =>
            (lastMinNumber = checkNumbers && value ? value : lastMinNumber),
        ),
        takeUntil(this.destroyed$),
      )
      .subscribe(([, checkNumbers]) => this.numbers.setValue(checkNumbers, { emitEvent: false }));

    let lastMinSpecial = 1;
    this.special.valueChanges
      .pipe(
        filter((checked) => !(checked && (this.minSpecial.value ?? 0) > 0)),
        map((checked) => (checked ? lastMinSpecial : 0)),
        takeUntil(this.destroyed$),
      )
      .subscribe((value) => this.minSpecial.setValue(value, { emitEvent: false }));

    this.minSpecial.valueChanges
      .pipe(
        map((value) => [value, (value ?? 0) > 0] as const),
        tap(
          ([value, checkSpecial]) =>
            (lastMinSpecial = checkSpecial && value ? value : lastMinSpecial),
        ),
        takeUntil(this.destroyed$),
      )
      .subscribe(([, checkSpecial]) => this.special.setValue(checkSpecial, { emitEvent: false }));

    // `onUpdated` depends on `settings` because the UserStateSubject is asynchronous;
    // subscribing directly to `this.settings.valueChanges` introduces a race condition.
    // skip the first emission because it's the initial value, not an update.
    settings.pipe(skip(1), takeUntil(this.destroyed$)).subscribe(this.onUpdated);

    // now that outputs are set up, connect inputs
    this.saveSettings
      .pipe(
        withLatestFrom(this.settings.valueChanges),
        map(([, settings]) => {
          // interface is "avoid" while storage is "include"
          const s: any = { ...settings };
          s.ambiguous = !s.avoidAmbiguous;
          delete s.avoidAmbiguous;
          return s;
        }),
        takeUntil(this.destroyed$),
      )
      .subscribe(settings);
  }

  private saveSettings = new Subject<string>();
  save(site: string = "component api call") {
    this.saveSettings.next(site);
  }

  /** display binding for enterprise policy notice */
  protected policyInEffect: boolean = false;

  private lengthBoundariesHint = new ReplaySubject<string>(1);

  /** display binding for min/max constraints of `length` */
  protected lengthBoundariesHint$ = this.lengthBoundariesHint.asObservable();

  private toggleEnabled(setting: keyof typeof Controls, enabled: boolean) {
    if (enabled) {
      this.settings.get(setting)?.enable({ emitEvent: false });
    } else {
      this.settings.get(setting)?.disable({ emitEvent: false });
    }
  }

  private readonly destroyed$ = new Subject<void>();
  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
  }
}
