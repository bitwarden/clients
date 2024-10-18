import { Component, EventEmitter, Input, NgZone, OnDestroy, OnInit, Output } from "@angular/core";
import { FormBuilder } from "@angular/forms";
import {
  BehaviorSubject,
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
import { UserId } from "@bitwarden/common/types/guid";
import { Option } from "@bitwarden/components/src/select/option";
import {
  CredentialAlgorithm,
  CredentialCategory,
  CredentialGeneratorInfo,
  CredentialGeneratorService,
  GeneratedCredential,
  Generators,
  isEmailAlgorithm,
  isPasswordAlgorithm,
  isUsernameAlgorithm,
  PasswordAlgorithm,
} from "@bitwarden/generator-core";

/** root category that drills into username and email categories */
const IDENTIFIER = "identifier";
/** options available for the top-level navigation */
type RootNavValue = PasswordAlgorithm | typeof IDENTIFIER;

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

  /** Emits the copy button aria-label respective of the selected credential type */
  protected credentialTypeCopyLabel$ = this.root$.pipe(
    map(({ nav }) => {
      if (nav === "password") {
        return this.i18nService.t("copyPassword");
      }

      if (nav === "passphrase") {
        return this.i18nService.t("copyPassphrase");
      }

      return this.i18nService.t("copyUsername");
    }),
  );

  /** Emits the generate button aria-label respective of the selected credential type */
  protected credentialTypeGenerateLabel$ = this.root$.pipe(
    map(({ nav }) => {
      if (nav === "password") {
        return this.i18nService.t("generatePassword");
      }

      if (nav === "passphrase") {
        return this.i18nService.t("generatePassphrase");
      }

      return this.i18nService.t("generateUsername");
    }),
  );

  protected onRootChanged(nav: RootNavValue) {
    // prevent subscription cycle
    if (this.root$.value.nav !== nav) {
      this.zone.run(() => {
        this.root$.next({ nav });
      });
    }
  }

  protected username = this.formBuilder.group({
    nav: [null as CredentialAlgorithm],
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
        map((algorithms) => this.toOptions(algorithms)),
        takeUntil(this.destroyed),
      )
      .subscribe(this.usernameOptions$);

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
        map((a) => a?.descriptionKey && this.i18nService.t(a?.descriptionKey)),
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

    // assume the last-visible generator algorithm is the user's preferred one
    const preferences = await this.generatorService.preferences({ singleUserId$: this.userId$ });
    this.root$
      .pipe(
        filter(({ nav }) => !!nav),
        switchMap((root) => {
          if (root.nav === IDENTIFIER) {
            return concat(of(this.username.value), this.username.valueChanges);
          } else {
            return of(root as { nav: PasswordAlgorithm });
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

    // populate the form with the user's preferences to kick off interactivity
    preferences.pipe(takeUntil(this.destroyed)).subscribe(({ email, username, password }) => {
      // the last preference set by the user "wins"
      const userNav = email.updated > username.updated ? email : username;
      const rootNav: any = userNav.updated > password.updated ? IDENTIFIER : password.algorithm;
      const credentialType = rootNav === IDENTIFIER ? userNav.algorithm : password.algorithm;

      // update navigation; break subscription loop
      this.onRootChanged(rootNav);
      this.username.setValue({ nav: userNav.algorithm }, { emitEvent: false });

      // load algorithm metadata
      const algorithm = this.generatorService.algorithm(credentialType);

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

      default:
        throw new Error(`Invalid generator type: "${type}"`);
    }
  }

  /** Lists the credential types of the username algorithm box. */
  protected usernameOptions$ = new BehaviorSubject<Option<CredentialAlgorithm>[]>([]);

  /** Lists the top-level credential types supported by the component. */
  protected rootOptions$ = new BehaviorSubject<Option<RootNavValue>[]>([]);

  /** tracks the currently selected credential type */
  protected algorithm$ = new ReplaySubject<CredentialGeneratorInfo>(1);

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

  private toOptions(algorithms: CredentialGeneratorInfo[]) {
    const options: Option<CredentialAlgorithm>[] = algorithms.map((algorithm) => ({
      value: algorithm.id,
      label: this.i18nService.t(algorithm.nameKey),
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
