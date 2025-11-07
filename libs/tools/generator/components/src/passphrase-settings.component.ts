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
import { skip, takeUntil, Subject, map, withLatestFrom, ReplaySubject, tap } from "rxjs";

import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  SemanticLogger,
  disabledSemanticLoggerProvider,
  ifEnabledSemanticLoggerProvider,
} from "@bitwarden/common/tools/log";
import {
  CredentialGeneratorService,
  PassphraseGenerationOptions,
  BuiltIn,
} from "@bitwarden/generator-core";

const Controls = Object.freeze({
  numWords: "numWords",
  includeNumber: "includeNumber",
  capitalize: "capitalize",
  wordSeparator: "wordSeparator",
});

/** Options group for passphrases */
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "tools-passphrase-settings",
  templateUrl: "passphrase-settings.component.html",
  standalone: false,
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
    private logService: LogService,
  ) {}

  /** Send structured debug logs from the credential generator component
   *  to the debugger console.
   *
   *  @warning this may reveal sensitive information in plaintext.
   */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input()
  debug: boolean = false;

  // this `log` initializer is overridden in `ngOnInit`
  private log: SemanticLogger = disabledSemanticLoggerProvider({});

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

  /** Removes bottom margin from `bit-section` */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input({ transform: coerceBooleanProperty }) disableMargin = false;

  /** Emits settings updates and completes if the settings become unavailable.
   * @remarks this does not emit the initial settings. If you would like
   *   to receive live settings updates including the initial update,
   *   use {@link CredentialGeneratorService.settings} instead.
   */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output()
  readonly onUpdated = new EventEmitter<PassphraseGenerationOptions>();

  protected settings = this.formBuilder.group({
    [Controls.numWords]: [0],
    [Controls.wordSeparator]: [""],
    [Controls.capitalize]: [false],
    [Controls.includeNumber]: [false],
  });

  async ngOnInit() {
    this.log = ifEnabledSemanticLoggerProvider(this.debug, this.logService, {
      type: "PassphraseSettingsComponent",
    });

    const settings = await this.generatorService.settings(BuiltIn.passphrase, {
      account$: this.account$,
    });

    // skips reactive event emissions to break a subscription cycle
    settings.withConstraints$
      .pipe(
        tap((content) => this.log.debug(content, "passphrase settings loaded with constraints")),
        takeUntil(this.destroyed$),
      )
      .subscribe(({ state, constraints }) => {
        this.settings.patchValue(state, { emitEvent: false });

        let boundariesHint = this.i18nService.t(
          "spinboxBoundariesHint",
          constraints.numWords?.min?.toString(),
          constraints.numWords?.max?.toString(),
        );
        if ((state.numWords ?? 0) <= (constraints.numWords?.recommendation ?? 0)) {
          boundariesHint += this.i18nService.t(
            "passphraseNumWordsRecommendationHint",
            constraints.numWords?.recommendation?.toString(),
          );
        }
        this.numWordsBoundariesHint.next(boundariesHint);
      });

    // the first emission is the current value; subsequent emissions are updates
    settings
      .pipe(
        skip(1),
        tap((settings) => this.log.debug(settings, "passphrase settings onUpdate event")),
        takeUntil(this.destroyed$),
      )
      .subscribe(this.onUpdated);

    // explain policy & disable policy-overridden fields
    this.generatorService
      .policy$(BuiltIn.passphrase, { account$: this.account$ })
      .pipe(takeUntil(this.destroyed$))
      .subscribe(({ constraints }) => {
        this.wordSeparatorMaxLength = constraints.wordSeparator?.maxLength ?? 0;
        this.policyInEffect = constraints.policyInEffect ?? false;

        this.toggleEnabled(Controls.capitalize, !constraints.capitalize?.readonly);
        this.toggleEnabled(Controls.includeNumber, !constraints.includeNumber?.readonly);
      });

    // now that outputs are set up, connect inputs
    this.saveSettings
      .pipe(
        withLatestFrom(this.settings.valueChanges),
        tap(([source, form]) =>
          this.log.debug({ source, form }, "save passphrase settings request"),
        ),
        map(([, settings]) => settings as PassphraseGenerationOptions),
        takeUntil(this.destroyed$),
      )
      .subscribe(settings);
  }

  /** attribute binding for wordSeparator[maxlength] */
  protected wordSeparatorMaxLength: number = 0;

  private saveSettings = new Subject<string>();
  save(source: string = "component api call") {
    this.saveSettings.next(source);
  }

  /** display binding for enterprise policy notice */
  protected policyInEffect: boolean = false;

  private numWordsBoundariesHint = new ReplaySubject<string>(1);

  /** display binding for min/max constraints of `numWords` */
  protected numWordsBoundariesHint$ = this.numWordsBoundariesHint.asObservable();

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
