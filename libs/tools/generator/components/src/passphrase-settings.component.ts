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
import { skip, takeUntil, Subject, map, withLatestFrom, ReplaySubject } from "rxjs";

import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  Generators,
  CredentialGeneratorService,
  PassphraseGenerationOptions,
} from "@bitwarden/generator-core";

const Controls = Object.freeze({
  numWords: "numWords",
  includeNumber: "includeNumber",
  capitalize: "capitalize",
  wordSeparator: "wordSeparator",
});

/** Options group for passphrases */
@Component({
  selector: "tools-passphrase-settings",
  templateUrl: "passphrase-settings.component.html",
})
export class PassphraseSettingsComponent implements OnInit, OnChanges, OnDestroy {
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

  /** Removes bottom margin from `bit-section` */
  @Input({ transform: coerceBooleanProperty }) disableMargin = false;

  /** Emits settings updates and completes if the settings become unavailable.
   * @remarks this does not emit the initial settings. If you would like
   *   to receive live settings updates including the initial update,
   *   use `CredentialGeneratorService.settings$(...)` instead.
   */
  @Output()
  readonly onUpdated = new EventEmitter<PassphraseGenerationOptions>();

  protected settings = this.formBuilder.group({
    [Controls.numWords]: [Generators.passphrase.settings.initial.numWords],
    [Controls.wordSeparator]: [Generators.passphrase.settings.initial.wordSeparator],
    [Controls.capitalize]: [Generators.passphrase.settings.initial.capitalize],
    [Controls.includeNumber]: [Generators.passphrase.settings.initial.includeNumber],
  });

  async ngOnInit() {
    const settings = await this.generatorService.settings(Generators.passphrase, {
      account$: this.account$,
    });

    // skips reactive event emissions to break a subscription cycle
    settings.withConstraints$
      .pipe(takeUntil(this.destroyed$))
      .subscribe(({ state, constraints }) => {
        this.settings.patchValue(state, { emitEvent: false });

        let boundariesHint = this.i18nService.t(
          "spinboxBoundariesHint",
          constraints.numWords.min?.toString(),
          constraints.numWords.max?.toString(),
        );
        if (state.numWords <= (constraints.numWords.recommendation ?? 0)) {
          boundariesHint += this.i18nService.t(
            "passphraseNumWordsRecommendationHint",
            constraints.numWords.recommendation?.toString(),
          );
        }
        this.numWordsBoundariesHint.next(boundariesHint);
      });

    // the first emission is the current value; subsequent emissions are updates
    settings.pipe(skip(1), takeUntil(this.destroyed$)).subscribe(this.onUpdated);

    // explain policy & disable policy-overridden fields
    this.generatorService
      .policy$(Generators.passphrase, { account$: this.account$ })
      .pipe(takeUntil(this.destroyed$))
      .subscribe(({ constraints }) => {
        this.wordSeparatorMaxLength = constraints.wordSeparator.maxLength;
        this.policyInEffect = constraints.policyInEffect;

        this.toggleEnabled(Controls.capitalize, !constraints.capitalize?.readonly);
        this.toggleEnabled(Controls.includeNumber, !constraints.includeNumber?.readonly);
      });

    // now that outputs are set up, connect inputs
    this.saveSettings
      .pipe(
        withLatestFrom(this.settings.valueChanges),
        map(([, settings]) => settings),
        takeUntil(this.destroyed$),
      )
      .subscribe(settings);
  }

  /** attribute binding for wordSeparator[maxlength] */
  protected wordSeparatorMaxLength: number;

  private saveSettings = new Subject<string>();
  save(site: string = "component api call") {
    this.saveSettings.next(site);
  }

  /** display binding for enterprise policy notice */
  protected policyInEffect: boolean;

  private numWordsBoundariesHint = new ReplaySubject<string>(1);

  /** display binding for min/max constraints of `numWords` */
  protected numWordsBoundariesHint$ = this.numWordsBoundariesHint.asObservable();

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
