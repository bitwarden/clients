// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { LiveAnnouncer } from "@angular/cdk/a11y";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import {
  Component,
  EventEmitter,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
} from "@angular/core";
import { FormBuilder } from "@angular/forms";
import {
  BehaviorSubject,
  catchError,
  combineLatest,
  combineLatestWith,
  distinctUntilChanged,
  filter,
  firstValueFrom,
  map,
  ReplaySubject,
  Subject,
  switchMap,
  takeUntil,
  withLatestFrom,
} from "rxjs";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { IntegrationId } from "@bitwarden/common/tools/integration";
import {
  SemanticLogger,
  disabledSemanticLoggerProvider,
  ifEnabledSemanticLoggerProvider,
} from "@bitwarden/common/tools/log";
import { UserId } from "@bitwarden/common/types/guid";
import { ToastService, Option } from "@bitwarden/components";
import {
  AlgorithmInfo,
  CredentialAlgorithm,
  CredentialCategories,
  CredentialGeneratorService,
  GenerateRequest,
  GeneratedCredential,
  Generators,
  getForwarderConfiguration,
  isEmailAlgorithm,
  isForwarderIntegration,
  isSameAlgorithm,
  isUsernameAlgorithm,
  toCredentialGeneratorConfiguration,
} from "@bitwarden/generator-core";
import { GeneratorHistoryService } from "@bitwarden/generator-history";

// constants used to identify navigation selections that are not
// generator algorithms
const FORWARDER = "forwarder";
const NONE_SELECTED = "none";

/** Component that generates usernames and emails */
@Component({
  selector: "tools-username-generator",
  templateUrl: "username-generator.component.html",
})
export class UsernameGeneratorComponent implements OnInit, OnChanges, OnDestroy {
  /** Instantiates the username generator
   *  @param generatorService generates credentials; stores preferences
   *  @param i18nService localizes generator algorithm descriptions
   *  @param accountService discovers the active user when one is not provided
   *  @param zone detects generator settings updates originating from the generator services
   *  @param formBuilder binds reactive form
   */
  constructor(
    private generatorService: CredentialGeneratorService,
    private generatorHistoryService: GeneratorHistoryService,
    private toastService: ToastService,
    private logService: LogService,
    private i18nService: I18nService,
    private accountService: AccountService,
    private zone: NgZone,
    private formBuilder: FormBuilder,
    private ariaLive: LiveAnnouncer,
  ) {}

  /** Binds the component to a specific user's settings. When this input is not provided,
   * the form binds to the active user
   */
  @Input()
  account: Account | null;

  protected account$ = new ReplaySubject<Account>(1);

  /** Send structured debug logs from the credential generator component
   *  to the debugger console.
   *
   *  @warning this may reveal sensitive information in plaintext.
   */
  @Input()
  debug: boolean = false;

  // this `log` initializer is overridden in `ngOnInit`
  private log: SemanticLogger = disabledSemanticLoggerProvider({});

  async ngOnChanges(changes: SimpleChanges) {
    const account = changes?.account;
    if (account?.previousValue?.id !== account?.currentValue?.id) {
      this.log.debug(
        {
          previousUserId: account?.previousValue?.id as UserId,
          currentUserId: account?.currentValue?.id as UserId,
        },
        "account input change detected",
      );
      this.account$.next(this.account);
    }
  }

  /**
   * The website associated with the credential generation request.
   */
  @Input()
  website: string | null = null;

  /** Emits credentials created from a generation request. */
  @Output()
  readonly onGenerated = new EventEmitter<GeneratedCredential>();

  /** emits algorithm info when the selected algorithm changes */
  @Output()
  readonly onAlgorithm = new EventEmitter<AlgorithmInfo>();

  /** Removes bottom margin from internal elements */
  @Input({ transform: coerceBooleanProperty }) disableMargin = false;

  /** Tracks the selected generation algorithm */
  protected username = this.formBuilder.group({
    nav: [null as string],
  });

  protected forwarder = this.formBuilder.group({
    nav: [null as string],
  });

  async ngOnInit() {
    this.log = ifEnabledSemanticLoggerProvider(this.debug, this.logService, {
      type: "UsernameGeneratorComponent",
    });

    if (!this.account) {
      this.account = await firstValueFrom(this.accountService.activeAccount$);
      this.log.info(
        { userId: this.account.id },
        "account not specified; using active account settings",
      );
      this.account$.next(this.account);
    }

    this.generatorService
      .algorithms$(["email", "username"], { account$: this.account$ })
      .pipe(
        map((algorithms) => {
          const usernames = algorithms.filter((a) => !isForwarderIntegration(a.id));
          const usernameOptions = this.toOptions(usernames);
          usernameOptions.push({ value: FORWARDER, label: this.i18nService.t("forwardedEmail") });

          const forwarders = algorithms.filter((a) => isForwarderIntegration(a.id));
          const forwarderOptions = this.toOptions(forwarders);
          forwarderOptions.unshift({ value: NONE_SELECTED, label: this.i18nService.t("select") });

          return [usernameOptions, forwarderOptions] as const;
        }),
        takeUntil(this.destroyed),
      )
      .subscribe(([usernames, forwarders]) => {
        this.typeOptions$.next(usernames);
        this.forwarderOptions$.next(forwarders);
      });

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

    // wire up the generator
    this.algorithm$
      .pipe(
        filter((algorithm) => !!algorithm),
        switchMap((algorithm) => this.typeToGenerator$(algorithm.id)),
        catchError((error: unknown, generator) => {
          if (typeof error === "string") {
            this.toastService.showToast({
              message: error,
              variant: "error",
              title: "",
            });
          } else {
            this.logService.error(error);
          }

          // continue with origin stream
          return generator;
        }),
        withLatestFrom(this.account$, this.algorithm$),
        takeUntil(this.destroyed),
      )
      .subscribe(([generated, account, algorithm]) => {
        this.log.debug({ source: generated.source }, "credential generated");

        this.generatorHistoryService
          .track(account.id, generated.credential, generated.category, generated.generationDate)
          .catch((e: unknown) => {
            this.logService.error(e);
          });

        // update subjects within the angular zone so that the
        // template bindings refresh immediately
        this.zone.run(() => {
          if (generated.source === this.USER_REQUEST) {
            this.announce(algorithm.onGeneratedMessage);
          }

          this.onGenerated.next(generated);
          this.value$.next(generated.credential);
        });
      });

    // normalize cascade selections; introduce subjects to allow changes
    // from user selections and changes from preference updates to
    // update the template
    type CascadeValue = { nav: string; algorithm?: CredentialAlgorithm };
    const activeIdentifier$ = new Subject<CascadeValue>();
    const activeForwarder$ = new Subject<CascadeValue>();

    this.username.valueChanges
      .pipe(
        map(
          (username): CascadeValue =>
            username.nav === FORWARDER
              ? { nav: username.nav }
              : { nav: username.nav, algorithm: JSON.parse(username.nav) },
        ),
        takeUntil(this.destroyed),
      )
      .subscribe(activeIdentifier$);

    this.forwarder.valueChanges
      .pipe(
        map(
          (forwarder): CascadeValue =>
            forwarder.nav === NONE_SELECTED
              ? { nav: forwarder.nav }
              : { nav: forwarder.nav, algorithm: JSON.parse(forwarder.nav) },
        ),
        takeUntil(this.destroyed),
      )
      .subscribe(activeForwarder$);

    // update forwarder cascade visibility
    combineLatest([activeIdentifier$, activeForwarder$])
      .pipe(
        map(([username, forwarder]) => {
          const showForwarder = !username.algorithm;
          const forwarderId =
            showForwarder && isForwarderIntegration(forwarder.algorithm)
              ? forwarder.algorithm.forwarder
              : null;
          return [showForwarder, forwarderId] as const;
        }),
        distinctUntilChanged((prev, next) => prev[0] === next[0] && prev[1] === next[1]),
        takeUntil(this.destroyed),
      )
      .subscribe(([showForwarder, forwarderId]) => {
        this.log.debug({ forwarderId, showForwarder }, "forwarder visibility updated");

        // update subjects within the angular zone so that the
        // template bindings refresh immediately
        this.zone.run(() => {
          this.showForwarder$.next(showForwarder);
          this.forwarderId$.next(forwarderId);
        });
      });

    // update active algorithm
    combineLatest([activeIdentifier$, activeForwarder$])
      .pipe(
        map(([username, forwarder]) => {
          const selection = username.algorithm ?? forwarder.algorithm;
          if (selection) {
            return this.generatorService.algorithm(selection);
          } else {
            return null;
          }
        }),
        distinctUntilChanged((prev, next) => isSameAlgorithm(prev?.id, next?.id)),
        takeUntil(this.destroyed),
      )
      .subscribe((algorithm) => {
        this.log.debug(algorithm, "algorithm selected");

        // update subjects within the angular zone so that the
        // template bindings refresh immediately
        this.zone.run(() => {
          this.algorithm$.next(algorithm);
          this.onAlgorithm.next(algorithm);
        });
      });

    // assume the last-visible generator algorithm is the user's preferred one
    const preferences = await this.generatorService.preferences({ account$: this.account$ });
    this.algorithm$
      .pipe(
        filter((algorithm) => !!algorithm),
        withLatestFrom(preferences),
        takeUntil(this.destroyed),
      )
      .subscribe(([algorithm, preference]) => {
        if (isEmailAlgorithm(algorithm.id)) {
          this.log.info(
            { algorithm, category: CredentialCategories.email },
            "algorithm preferences updated",
          );
          preference.email.algorithm = algorithm.id;
          preference.email.updated = new Date();
        } else if (isUsernameAlgorithm(algorithm.id)) {
          this.log.info(
            { algorithm, category: CredentialCategories.username },
            "algorithm preferences updated",
          );
          preference.username.algorithm = algorithm.id;
          preference.username.updated = new Date();
        } else {
          return;
        }

        preferences.next(preference);
      });

    preferences
      .pipe(
        map(({ email, username }) => {
          const forwarderPref = isForwarderIntegration(email.algorithm) ? email : null;
          const usernamePref = email.updated > username.updated ? email : username;

          // inject drilldown flags
          const forwarderNav = !forwarderPref
            ? NONE_SELECTED
            : JSON.stringify(forwarderPref.algorithm);
          const userNav = forwarderPref ? FORWARDER : JSON.stringify(usernamePref.algorithm);

          // construct cascade metadata
          const cascade = {
            username: {
              selection: { nav: userNav },
              active: {
                nav: userNav,
                algorithm: forwarderPref ? null : usernamePref.algorithm,
              },
            },
            forwarder: {
              selection: { nav: forwarderNav },
              active: {
                nav: forwarderNav,
                algorithm: forwarderPref?.algorithm,
              },
            },
          };

          return cascade;
        }),
        takeUntil(this.destroyed),
      )
      .subscribe(({ username, forwarder }) => {
        // update navigation; break subscription loop
        this.username.setValue(username.selection, { emitEvent: false });
        this.forwarder.setValue(forwarder.selection, { emitEvent: false });

        // update cascade visibility
        activeIdentifier$.next(username.active);
        activeForwarder$.next(forwarder.active);
      });

    // automatically regenerate when the algorithm switches if the algorithm
    // allows it; otherwise set a placeholder
    this.algorithm$.pipe(takeUntil(this.destroyed)).subscribe((a) => {
      this.zone.run(() => {
        if (!a || a.onlyOnRequest) {
          this.log.debug("autogeneration disabled; clearing generated credential");
          this.value$.next("-");
        } else {
          this.log.debug("autogeneration enabled");

          this.generate("autogenerate").catch((e: unknown) => {
            this.log.error(e as object, "a failure occurred during autogeneration");
          });
        }
      });
    });

    this.log.debug("component initialized");
  }

  private typeToGenerator$(algorithm: CredentialAlgorithm) {
    const dependencies = {
      on$: this.generate$,
      account$: this.account$,
    };

    this.log.debug({ algorithm }, "constructing generation stream");

    switch (algorithm) {
      case "catchall":
        return this.generatorService.generate$(Generators.catchall, dependencies);

      case "subaddress":
        return this.generatorService.generate$(Generators.subaddress, dependencies);

      case "username":
        return this.generatorService.generate$(Generators.username, dependencies);
    }

    if (isForwarderIntegration(algorithm)) {
      const forwarder = getForwarderConfiguration(algorithm.forwarder);
      const configuration = toCredentialGeneratorConfiguration(forwarder);
      return this.generatorService.generate$(configuration, dependencies);
    }

    this.log.panic({ algorithm }, `Invalid generator type: "${algorithm}"`);
  }

  private announce(message: string) {
    this.ariaLive.announce(message).catch((e) => this.logService.error(e));
  }

  /** Lists the credential types supported by the component. */
  protected typeOptions$ = new BehaviorSubject<Option<string>[]>([]);

  /** Tracks the currently selected forwarder. */
  protected forwarderId$ = new BehaviorSubject<IntegrationId>(null);

  /** Lists the credential types supported by the component. */
  protected forwarderOptions$ = new BehaviorSubject<Option<string>[]>([]);

  /** Tracks forwarder control visibility */
  protected showForwarder$ = new BehaviorSubject<boolean>(false);

  /** tracks the currently selected credential type */
  protected algorithm$ = new ReplaySubject<AlgorithmInfo>(1);

  /** Emits hint key for the currently selected credential type */
  protected credentialTypeHint$ = new ReplaySubject<string>(1);

  /** Emits the last generated value. */
  protected readonly value$ = new BehaviorSubject<string>("");

  /** Emits when a new credential is requested */
  private readonly generate$ = new Subject<GenerateRequest>();

  protected showAlgorithm$ = this.algorithm$.pipe(
    combineLatestWith(this.showForwarder$),
    map(([algorithm, showForwarder]) => (showForwarder ? null : algorithm)),
  );

  /**
   * Emits the copy button aria-label respective of the selected credential type
   */
  protected credentialTypeCopyLabel$ = this.algorithm$.pipe(
    filter((algorithm) => !!algorithm),
    map(({ copy }) => copy),
  );

  /**
   * Emits the generate button aria-label respective of the selected credential type
   */
  protected credentialTypeGenerateLabel$ = this.algorithm$.pipe(
    filter((algorithm) => !!algorithm),
    map(({ generate }) => generate),
  );

  /**
   * Emits the copy credential toast respective of the selected credential type
   */
  protected credentialTypeLabel$ = this.algorithm$.pipe(
    filter((algorithm) => !!algorithm),
    map(({ credentialType }) => credentialType),
  );

  /** Identifies generator requests that were requested by the user */
  protected readonly USER_REQUEST = "user request";

  /** Request a new value from the generator
   * @param source a label used to trace generation request
   *  origin in the debugger.
   */
  protected async generate(source: string) {
    const request = { source, website: this.website };
    this.log.debug(request, "generation requested");
    this.generate$.next(request);
  }

  private toOptions(algorithms: AlgorithmInfo[]) {
    const options: Option<string>[] = algorithms.map((algorithm) => ({
      value: JSON.stringify(algorithm.id),
      label: algorithm.name,
    }));

    return options;
  }

  private readonly destroyed = new Subject<void>();
  ngOnDestroy() {
    this.destroyed.next();
    this.destroyed.complete();

    // finalize subjects
    this.generate$.complete();
    this.value$.complete();

    // finalize component bindings
    this.onGenerated.complete();
  }
}
