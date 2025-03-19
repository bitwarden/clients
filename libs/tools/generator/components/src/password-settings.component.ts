// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
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
  Generators,
  CredentialGeneratorService,
  PasswordGenerationOptions,
} from "@bitwarden/generator-core";

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
@Component({
  selector: "tools-password-settings",
  templateUrl: "password-settings.component.html",
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
   */
  @Input({ required: true })
  account: Account;

  protected account$ = new ReplaySubject<Account>(1);

  async ngOnChanges(changes: SimpleChanges) {
    if ("account" in changes && changes.account) {
      this.account$.next(this.account);
    }
  }

  /** When `true`, an options header is displayed by the component. Otherwise, the header is hidden. */
  @Input()
  showHeader: boolean = true;

  /** Number of milliseconds to wait before accepting user input. */
  @Input()
  waitMs: number = 100;

  /** Removes bottom margin from `bit-section` */
  @Input({ transform: coerceBooleanProperty }) disableMargin = false;

  /** Emits settings updates and completes if the settings become unavailable.
   * @remarks this does not emit the initial settings. If you would like
   *   to receive live settings updates including the initial update,
   *   use `CredentialGeneratorService.settings$(...)` instead.
   */
  @Output()
  readonly onUpdated = new EventEmitter<PasswordGenerationOptions>();

  protected settings = this.formBuilder.group({
    [Controls.length]: [Generators.password.settings.initial.length],
    [Controls.uppercase]: [Generators.password.settings.initial.uppercase],
    [Controls.lowercase]: [Generators.password.settings.initial.lowercase],
    [Controls.number]: [Generators.password.settings.initial.number],
    [Controls.special]: [Generators.password.settings.initial.special],
    [Controls.minNumber]: [Generators.password.settings.initial.minNumber],
    [Controls.minSpecial]: [Generators.password.settings.initial.minSpecial],
    [Controls.avoidAmbiguous]: [!Generators.password.settings.initial.ambiguous],
  });

  private get numbers() {
    return this.settings.get(Controls.number);
  }

  private get special() {
    return this.settings.get(Controls.special);
  }

  private get minNumber() {
    return this.settings.get(Controls.minNumber);
  }

  private get minSpecial() {
    return this.settings.get(Controls.minSpecial);
  }

  async ngOnInit() {
    const settings = await this.generatorService.settings(Generators.password, {
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
          constraints.length.min?.toString(),
          constraints.length.max?.toString(),
        );
        if (state.length <= (constraints.length.recommendation ?? 0)) {
          boundariesHint += this.i18nService.t(
            "passwordLengthRecommendationHint",
            constraints.length.recommendation?.toString(),
          );
        }
        this.lengthBoundariesHint.next(boundariesHint);

        // skips reactive event emissions to break a subscription cycle
        this.settings.patchValue(state, { emitEvent: false });
      });

    // explain policy & disable policy-overridden fields
    this.generatorService
      .policy$(Generators.password, { account$: this.account$ })
      .pipe(takeUntil(this.destroyed$))
      .subscribe(({ constraints }) => {
        this.policyInEffect = constraints.policyInEffect;

        const toggles = [
          [Controls.length, constraints.length.min < constraints.length.max],
          [Controls.uppercase, !constraints.uppercase?.readonly],
          [Controls.lowercase, !constraints.lowercase?.readonly],
          [Controls.number, !constraints.number?.readonly],
          [Controls.special, !constraints.special?.readonly],
          [Controls.minNumber, constraints.minNumber.min < constraints.minNumber.max],
          [Controls.minSpecial, constraints.minSpecial.min < constraints.minSpecial.max],
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
        filter((checked) => !(checked && this.minNumber.value > 0)),
        map((checked) => (checked ? lastMinNumber : 0)),
        takeUntil(this.destroyed$),
      )
      .subscribe((value) => this.minNumber.setValue(value, { emitEvent: false }));

    this.minNumber.valueChanges
      .pipe(
        map((value) => [value, value > 0] as const),
        tap(([value, checkNumbers]) => (lastMinNumber = checkNumbers ? value : lastMinNumber)),
        takeUntil(this.destroyed$),
      )
      .subscribe(([, checkNumbers]) => this.numbers.setValue(checkNumbers, { emitEvent: false }));

    let lastMinSpecial = 1;
    this.special.valueChanges
      .pipe(
        filter((checked) => !(checked && this.minSpecial.value > 0)),
        map((checked) => (checked ? lastMinSpecial : 0)),
        takeUntil(this.destroyed$),
      )
      .subscribe((value) => this.minSpecial.setValue(value, { emitEvent: false }));

    this.minSpecial.valueChanges
      .pipe(
        map((value) => [value, value > 0] as const),
        tap(([value, checkSpecial]) => (lastMinSpecial = checkSpecial ? value : lastMinSpecial)),
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
  protected policyInEffect: boolean;

  private lengthBoundariesHint = new ReplaySubject<string>(1);

  /** display binding for min/max constraints of `length` */
  protected lengthBoundariesHint$ = this.lengthBoundariesHint.asObservable();

  private toggleEnabled(setting: keyof typeof Controls, enabled: boolean) {
    if (enabled) {
      this.settings.get(setting).enable({ emitEvent: false });
    } else {
      this.settings.get(setting).disable({ emitEvent: false });
    }
  }

  private readonly destroyed$ = new Subject<void>();
  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
  }
}
