import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { Component, EventEmitter, Input, NgZone, OnDestroy, OnInit, Output } from "@angular/core";
import {
  BehaviorSubject,
  distinctUntilChanged,
  filter,
  map,
  ReplaySubject,
  Subject,
  switchMap,
  takeUntil,
  withLatestFrom,
} from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UserId } from "@bitwarden/common/types/guid";
import { Option } from "@bitwarden/components/src/select/option";
import {
  CredentialGeneratorService,
  Generators,
  PasswordAlgorithm,
  GeneratedCredential,
  CredentialGeneratorInfo,
  CredentialAlgorithm,
  isPasswordAlgorithm,
} from "@bitwarden/generator-core";

/** Options group for passwords */
@Component({
  selector: "tools-password-generator",
  templateUrl: "password-generator.component.html",
})
export class PasswordGeneratorComponent implements OnInit, OnDestroy {
  constructor(
    private generatorService: CredentialGeneratorService,
    private i18nService: I18nService,
    private accountService: AccountService,
    private zone: NgZone,
  ) {}

  /** Binds the component to a specific user's settings.
   *  When this input is not provided, the form binds to the active
   *  user
   */
  @Input()
  userId: UserId | null;

  /** Removes bottom margin, passed to downstream components */
  @Input({ transform: coerceBooleanProperty }) disableMargin = false;

  /** tracks the currently selected credential type */
  protected credentialType$ = new BehaviorSubject<PasswordAlgorithm>(null);

  /** Emits the last generated value. */
  protected readonly value$ = new BehaviorSubject<string>("");

  /** Emits when the userId changes */
  protected readonly userId$ = new BehaviorSubject<UserId>(null);

  /** Emits when a new credential is requested */
  protected readonly generate$ = new Subject<void>();

  /** Tracks changes to the selected credential type
   * @param type the new credential type
   */
  protected onCredentialTypeChanged(type: PasswordAlgorithm) {
    // break subscription cycle
    if (this.credentialType$.value !== type) {
      this.zone.run(() => {
        this.credentialType$.next(type);
      });
    }
  }

  /** Emits credentials created from a generation request. */
  @Output()
  readonly onGenerated = new EventEmitter<GeneratedCredential>();

  async ngOnInit() {
    if (this.userId) {
      this.userId$.next(this.userId);
    } else {
      this.accountService.activeAccount$
        .pipe(
          map((acct) => acct.id),
          distinctUntilChanged(),
          takeUntil(this.destroyed),
        )
        .subscribe(this.userId$);
    }

    this.generatorService
      .algorithms$("password", { userId$: this.userId$ })
      .pipe(
        map((algorithms) => this.toOptions(algorithms)),
        takeUntil(this.destroyed),
      )
      .subscribe(this.passwordOptions$);

    // wire up the generator
    this.algorithm$
      .pipe(
        switchMap((algorithm) => this.typeToGenerator$(algorithm.id)),
        takeUntil(this.destroyed),
      )
      .subscribe((generated) => {
        // update subjects within the angular zone so that the
        // template bindings refresh immediately
        this.zone.run(() => {
          this.onGenerated.next(generated);
          this.value$.next(generated.credential);
        });
      });

    // assume the last-visible generator algorithm is the user's preferred one
    const preferences = await this.generatorService.preferences({ singleUserId$: this.userId$ });
    this.credentialType$
      .pipe(
        filter((type) => !!type),
        withLatestFrom(preferences),
        takeUntil(this.destroyed),
      )
      .subscribe(([algorithm, preference]) => {
        if (isPasswordAlgorithm(algorithm)) {
          preference.password.algorithm = algorithm;
          preference.password.updated = new Date();
        } else {
          return;
        }

        preferences.next(preference);
      });

    // populate the form with the user's preferences to kick off interactivity
    preferences.pipe(takeUntil(this.destroyed)).subscribe(({ password }) => {
      // update navigation
      this.onCredentialTypeChanged(password.algorithm);

      // load algorithm metadata
      const algorithm = this.generatorService.algorithm(password.algorithm);

      // update subjects within the angular zone so that the
      // template bindings refresh immediately
      this.zone.run(() => {
        this.algorithm$.next(algorithm);
      });
    });

    // generate on load unless the generator prohibits it
    this.algorithm$
      .pipe(
        distinctUntilChanged((prev, next) => prev.id === next.id),
        filter((a) => !a.onlyOnRequest),
        takeUntil(this.destroyed),
      )
      .subscribe(() => this.generate$.next());
  }

  private typeToGenerator$(type: CredentialAlgorithm) {
    const dependencies = {
      on$: this.generate$,
      userId$: this.userId$,
    };

    switch (type) {
      case "password":
        return this.generatorService.generate$(Generators.password, dependencies);

      case "passphrase":
        return this.generatorService.generate$(Generators.passphrase, dependencies);
      default:
        throw new Error(`Invalid generator type: "${type}"`);
    }
  }

  /** Lists the credential types supported by the component. */
  protected passwordOptions$ = new BehaviorSubject<Option<CredentialAlgorithm>[]>([]);

  /** tracks the currently selected credential type */
  protected algorithm$ = new ReplaySubject<CredentialGeneratorInfo>(1);

  private toOptions(algorithms: CredentialGeneratorInfo[]) {
    const options: Option<CredentialAlgorithm>[] = algorithms.map((algorithm) => ({
      value: algorithm.id,
      label: this.i18nService.t(algorithm.nameKey),
    }));

    return options;
  }

  private readonly destroyed = new Subject<void>();
  ngOnDestroy(): void {
    // tear down subscriptions
    this.destroyed.complete();

    // finalize subjects
    this.generate$.complete();
    this.value$.complete();

    // finalize component bindings
    this.onGenerated.complete();
  }
}
