import { Component, EventEmitter, Input, NgZone, OnDestroy, OnInit, Output } from "@angular/core";
import { FormBuilder } from "@angular/forms";
import {
  BehaviorSubject,
  combineLatestWith,
  concat,
  distinctUntilChanged,
  filter,
  map,
  of,
  ReplaySubject,
  Subject,
  switchMap,
  takeUntil,
  withLatestFrom,
} from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { IntegrationId } from "@bitwarden/common/tools/integration";
import { UserId } from "@bitwarden/common/types/guid";
import { Option } from "@bitwarden/components/src/select/option";
import {
  AlgorithmInfo,
  CredentialAlgorithm,
  CredentialCategory,
  CredentialGeneratorService,
  EmailAlgorithm,
  ForwarderIntegration,
  GeneratedCredential,
  Generators,
  getForwarderConfiguration,
  isEmailAlgorithm,
  isForwarderIntegration,
  isPasswordAlgorithm,
  isUsernameAlgorithm,
  PasswordAlgorithm,
  toCredentialGeneratorConfiguration,
  UsernameAlgorithm,
} from "@bitwarden/generator-core";

/** root category that drills into username and email categories */
const IDENTIFIER = "identifier";
/** options available for the top-level navigation */
type RootNavValue = PasswordAlgorithm | typeof IDENTIFIER;

const FORWARDER = "forwarder";
type UsernameNavValue = UsernameAlgorithm | EmailAlgorithm | typeof FORWARDER;

const NONE_SELECTED = "none";
type ForwarderNavValue = ForwarderIntegration | typeof NONE_SELECTED;

@Component({
  selector: "tools-credential-generator",
  templateUrl: "credential-generator.component.html",
})
export class CredentialGeneratorComponent implements OnInit, OnDestroy {
  constructor(
    private generatorService: CredentialGeneratorService,
    private i18nService: I18nService,
    private accountService: AccountService,
    private zone: NgZone,
    private formBuilder: FormBuilder,
  ) {}

  /** Binds the component to a specific user's settings. When this input is not provided,
   * the form binds to the active user
   */
  @Input()
  userId: UserId | null;

  /** Emits credentials created from a generation request. */
  @Output()
  readonly onGenerated = new EventEmitter<GeneratedCredential>();

  protected root$ = new BehaviorSubject<{ nav: RootNavValue }>({
    nav: null,
  });

  protected onRootChanged(value: { nav: RootNavValue }) {
    // prevent subscription cycle
    if (this.root$.value.nav !== value.nav) {
      this.zone.run(() => {
        this.root$.next(value);
      });
    }
  }

  protected username = this.formBuilder.group({
    nav: [null as UsernameNavValue],
  });

  protected forwarder = this.formBuilder.group({
    nav: [null as ForwarderNavValue],
  });

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
      .algorithms$(["email", "username"], { userId$: this.userId$ })
      .pipe(
        map((algorithms) => {
          const usernames = algorithms.filter((a) => !isForwarderIntegration(a.id));
          const usernameOptions = this.toOptions(usernames) as Option<UsernameNavValue>[];
          usernameOptions.push({ value: FORWARDER, label: this.i18nService.t("forwardedEmail") });

          const forwarders = algorithms.filter((a) => isForwarderIntegration(a.id));
          const forwarderOptions = this.toOptions(forwarders) as Option<ForwarderNavValue>[];
          forwarderOptions.unshift({ value: NONE_SELECTED, label: this.i18nService.t("select") });

          return [usernameOptions, forwarderOptions] as const;
        }),
        takeUntil(this.destroyed),
      )
      .subscribe(([usernames, forwarders]) => {
        this.usernameOptions$.next(usernames);
        this.forwarderOptions$.next(forwarders);
      });

    this.generatorService
      .algorithms$("password", { userId$: this.userId$ })
      .pipe(
        map((algorithms) => {
          const options = this.toOptions(algorithms) as Option<RootNavValue>[];
          options.push({ value: IDENTIFIER, label: this.i18nService.t("username") });
          return options;
        }),
        takeUntil(this.destroyed),
      )
      .subscribe(this.rootOptions$);

    this.algorithm$
      .pipe(
        map((a) => a?.description),
        takeUntil(this.destroyed),
      )
      .subscribe((hint) => {
        // update subjects within the angular zone so that the
        // template bindings refresh immediately
        this.zone.run(() => {
          this.credentialTypeHint$.next(hint);
        });
      });

    this.algorithm$
      .pipe(
        map((a) => a.category),
        distinctUntilChanged(),
        takeUntil(this.destroyed),
      )
      .subscribe((category) => {
        // update subjects within the angular zone so that the
        // template bindings refresh immediately
        this.zone.run(() => {
          this.category$.next(category);
        });
      });

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

    const username$ = new Subject<{ nav: UsernameNavValue }>();
    this.root$
      .pipe(
        filter(({ nav }) => !!nav),
        switchMap((maybeAlgorithm) => {
          if (maybeAlgorithm.nav === IDENTIFIER) {
            return concat(of(this.username.value), this.username.valueChanges);
          } else {
            return of(maybeAlgorithm as { nav: CredentialAlgorithm });
          }
        }),
        takeUntil(this.destroyed),
      )
      .subscribe(username$);

    // assume the last-visible generator algorithm is the user's preferred one
    const preferences = await this.generatorService.preferences({ singleUserId$: this.userId$ });
    username$
      .pipe(
        switchMap((maybeAlgorithm) => {
          if (maybeAlgorithm.nav === FORWARDER) {
            return concat(of(this.forwarder.value), this.forwarder.valueChanges);
          } else {
            return of(maybeAlgorithm as { nav: CredentialAlgorithm });
          }
        }),
        map((maybeAlgorithm) => {
          if (maybeAlgorithm.nav === NONE_SELECTED) {
            return { nav: null };
          } else {
            return maybeAlgorithm as { nav: CredentialAlgorithm };
          }
        }),
        filter(({ nav }) => !!nav),
        withLatestFrom(preferences),
        takeUntil(this.destroyed),
      )
      .subscribe(([{ nav: algorithm }, preference]) => {
        function setPreference(category: CredentialCategory) {
          const p = preference[category];
          p.algorithm = algorithm;
          p.updated = new Date();
        }

        // `is*Algorithm` decides `algorithm`'s type, which flows into `setPreference`
        if (isEmailAlgorithm(algorithm)) {
          setPreference("email");
        } else if (isUsernameAlgorithm(algorithm)) {
          setPreference("username");
        } else if (isPasswordAlgorithm(algorithm)) {
          setPreference("password");
        } else {
          return;
        }

        preferences.next(preference);
      });

    username$
      .pipe(
        map(({ nav }) => nav === FORWARDER),
        takeUntil(this.destroyed),
      )
      .subscribe((showForwarder) => {
        // update subjects within the angular zone so that the
        // template bindings refresh immediately
        this.zone.run(() => {
          if (showForwarder) {
            this.value$.next("-");
          }
          this.showForwarder$.next(showForwarder);
        });
      });

    // populate the form with the user's preferences to kick off interactivity
    preferences.pipe(takeUntil(this.destroyed)).subscribe(({ email, username, password }) => {
      // the last preference set by the user "wins"
      const forwarderPref = isForwarderIntegration(email.algorithm) ? email : null;
      const usernamePref = email.updated > username.updated ? email : username;
      const rootPref = usernamePref.updated > password.updated ? usernamePref : password;

      // inject drilldown flags
      const forwarderNav = !forwarderPref
        ? NONE_SELECTED
        : (forwarderPref.algorithm as ForwarderIntegration);
      const userNav = forwarderPref ? FORWARDER : (usernamePref.algorithm as UsernameAlgorithm);
      const rootNav =
        rootPref.algorithm == usernamePref.algorithm
          ? IDENTIFIER
          : (rootPref.algorithm as PasswordAlgorithm);

      // update navigation; break subscription loop
      this.onRootChanged({ nav: rootNav });
      this.username.setValue({ nav: userNav }, { emitEvent: false });
      this.forwarder.setValue({ nav: forwarderNav }, { emitEvent: false });

      // load algorithm metadata
      const algorithm = this.generatorService.algorithm(rootPref.algorithm);

      // update subjects within the angular zone so that the
      // template bindings refresh immediately
      this.zone.run(() => {
        this.algorithm$.next(algorithm);
        if (userNav === FORWARDER && forwarderNav !== NONE_SELECTED) {
          this.forwarderId$.next(forwarderNav.forwarder);
        } else {
          this.forwarderId$.next(null);
        }
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
      case "catchall":
        return this.generatorService.generate$(Generators.catchall, dependencies);

      case "subaddress":
        return this.generatorService.generate$(Generators.subaddress, dependencies);

      case "username":
        return this.generatorService.generate$(Generators.username, dependencies);

      case "password":
        return this.generatorService.generate$(Generators.password, dependencies);

      case "passphrase":
        return this.generatorService.generate$(Generators.passphrase, dependencies);
    }

    if (isForwarderIntegration(type)) {
      const forwarder = getForwarderConfiguration(type.forwarder);
      const configuration = toCredentialGeneratorConfiguration(forwarder);
      const generator = this.generatorService.generate$(configuration, dependencies);
      return generator;
    }

    throw new Error(`Invalid generator type: "${type}"`);
  }

  /** Lists the top-level credential types supported by the component. */
  protected rootOptions$ = new BehaviorSubject<Option<RootNavValue>[]>([]);

  /** Lists the credential types of the username algorithm box. */
  protected usernameOptions$ = new BehaviorSubject<Option<UsernameNavValue>[]>([]);

  /** Lists the credential types of the username algorithm box. */
  protected forwarderOptions$ = new BehaviorSubject<Option<ForwarderNavValue>[]>([]);

  /** Tracks the currently selected forwarder. */
  protected forwarderId$ = new BehaviorSubject<IntegrationId>(null);

  /** Tracks forwarder control visibility */
  protected showForwarder$ = new BehaviorSubject<boolean>(false);

  /** tracks the currently selected credential type */
  protected algorithm$ = new ReplaySubject<AlgorithmInfo>(1);

  protected showAlgorithm$ = this.algorithm$.pipe(
    combineLatestWith(this.showForwarder$),
    map(([algorithm, showForwarder]) => (showForwarder ? null : algorithm)),
  );

  /** Emits hint key for the currently selected credential type */
  protected credentialTypeHint$ = new ReplaySubject<string>(1);

  /** tracks the currently selected credential category */
  protected category$ = new ReplaySubject<string>(1);

  /** Emits the last generated value. */
  protected readonly value$ = new BehaviorSubject<string>("");

  /** Emits when the userId changes */
  protected readonly userId$ = new BehaviorSubject<UserId>(null);

  /** Emits when a new credential is requested */
  protected readonly generate$ = new Subject<void>();

  private toOptions(algorithms: AlgorithmInfo[]) {
    const options: Option<CredentialAlgorithm>[] = algorithms.map((algorithm) => ({
      value: algorithm.id,
      label: algorithm.name,
    }));

    return options;
  }

  private readonly destroyed = new Subject<void>();
  ngOnDestroy() {
    this.destroyed.complete();

    // finalize subjects
    this.generate$.complete();
    this.value$.complete();

    // finalize component bindings
    this.onGenerated.complete();
  }
}
