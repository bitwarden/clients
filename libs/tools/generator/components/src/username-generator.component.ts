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
  takeUntil,
  tap,
  withLatestFrom,
} from "rxjs";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { VendorId } from "@bitwarden/common/tools/extension";
import { UserId } from "@bitwarden/common/types/guid";
import { ToastService, Option } from "@bitwarden/components";
import {
  AlgorithmInfo,
  CredentialGeneratorService,
  GenerateRequest,
  GeneratedCredential,
  isForwarderExtensionId,
  isEmailAlgorithm,
  isUsernameAlgorithm,
  isSameAlgorithm,
  CredentialAlgorithm,
  AlgorithmMetadata,
  AlgorithmsByType,
  Type,
  Algorithm,
} from "@bitwarden/generator-core";
import { GeneratorHistoryService } from "@bitwarden/generator-history";
import {
  disabledSemanticLoggerProvider,
  ifEnabledSemanticLoggerProvider,
  SemanticLogger,
} from "@bitwarden/logging";

import { toAlgorithmInfo, translate } from "./util";

// constants used to identify navigation selections that are not
// generator algorithms
const FORWARDER = "forwarder";
const NONE_SELECTED = "none";

/** Component that generates usernames and emails */
@Component({
  selector: "tools-username-generator",
  templateUrl: "username-generator.component.html",
  standalone: false,
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

  /** exports algorithm symbols to the template */
  protected readonly Algorithm = Algorithm;

  /** Binds the component to a specific user's settings. When this input is not provided,
   * the form binds to the active user
   */
  @Input()
  account: Account | null = null;

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
    if (
      account &&
      account.currentValue.id &&
      account.previousValue.id !== account.currentValue.id
    ) {
      this.log.debug(
        {
          previousUserId: account?.previousValue?.id as UserId,
          currentUserId: account?.currentValue?.id as UserId,
        },
        "account input change detected",
      );
      this.account$.next(account.currentValue.id);
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
  readonly onAlgorithm = new EventEmitter<AlgorithmInfo | null>();

  /** Removes bottom margin from internal elements */
  @Input({ transform: coerceBooleanProperty }) disableMargin = false;

  /** Tracks the selected generation algorithm */
  protected username = this.formBuilder.group({
    nav: [null as string | null],
  });

  protected forwarder = this.formBuilder.group({
    nav: [null as string | null],
  });

  async ngOnInit() {
    this.log = ifEnabledSemanticLoggerProvider(this.debug, this.logService, {
      type: "UsernameGeneratorComponent",
    });

    if (!this.account) {
      const account = await firstValueFrom(this.accountService.activeAccount$);
      if (!account) {
        this.log.panic("active account cannot be `null`.");
      }

      this.log.info({ userId: account.id }, "account not specified; using active account settings");
      this.account$.next(account);
    }

    combineLatest([
      this.generatorService.algorithms$("email", { account$: this.account$ }),
      this.generatorService.algorithms$("username", { account$: this.account$ }),
    ])
      .pipe(
        map((algorithms) => algorithms.flat()),
        map((algorithms) => {
          // construct options for username and email algorithms; replace forwarder
          // entry with a virtual entry for drill-down
          const usernames = algorithms.filter((a) => !isForwarderExtensionId(a.id));
          usernames.sort((a, b) => a.weight - b.weight);
          const usernameOptions = this.toOptions(usernames);
          usernameOptions.splice(-1, 0, {
            value: FORWARDER,
            label: this.i18nService.t("forwardedEmail"),
          });

          // construct options for forwarder algorithms; they get their own selection box
          const forwarders = algorithms.filter((a) => isForwarderExtensionId(a.id));
          forwarders.sort((a, b) => a.weight - b.weight);
          const forwarderOptions = this.toOptions(forwarders);
          forwarderOptions.unshift({ value: NONE_SELECTED, label: this.i18nService.t("select") });

          return [usernameOptions, forwarderOptions] as const;
        }),
        tap((algorithms) =>
          this.log.debug({ algorithms: algorithms as object }, "algorithms loaded"),
        ),
        takeUntil(this.destroyed),
      )
      .subscribe(([usernames, forwarders]) => {
        // update subjects within the angular zone so that the
        // template bindings refresh immediately
        this.zone.run(() => {
          this.typeOptions$.next(usernames);
          this.forwarderOptions$.next(forwarders);
        });
      });

    this.maybeAlgorithm$
      .pipe(
        map((a) => {
          if (a?.i18nKeys?.description) {
            return translate(a.i18nKeys.description, this.i18nService);
          } else {
            return "";
          }
        }),
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
    this.generatorService
      .generate$({
        on$: this.generate$,
        account$: this.account$,
      })
      .pipe(
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
        withLatestFrom(this.account$, this.maybeAlgorithm$),
        takeUntil(this.destroyed),
      )
      .subscribe(([generated, account, algorithm]) => {
        this.log.debug(
          { source: generated.source ?? null, algorithm: algorithm?.id ?? null },
          "credential generated",
        );

        this.generatorHistoryService
          .track(account.id, generated.credential, generated.category, generated.generationDate)
          .catch((e: unknown) => {
            this.logService.error(e);
          });

        // update subjects within the angular zone so that the
        // template bindings refresh immediately
        this.zone.run(() => {
          if (algorithm && generated.source === this.USER_REQUEST) {
            this.announce(translate(algorithm.i18nKeys.credentialGenerated, this.i18nService));
          }

          this.generatedCredential$.next(generated);
          this.onGenerated.next(generated);
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
        map((username): CascadeValue => {
          if (username.nav === FORWARDER) {
            return { nav: username.nav };
          } else if (username.nav) {
            return { nav: username.nav, algorithm: JSON.parse(username.nav) };
          } else {
            const [algorithm] = AlgorithmsByType[Type.username];
            return { nav: JSON.stringify(algorithm), algorithm };
          }
        }),
        takeUntil(this.destroyed),
      )
      .subscribe(activeIdentifier$);

    this.forwarder.valueChanges
      .pipe(
        map((forwarder): CascadeValue => {
          if (forwarder.nav === NONE_SELECTED) {
            return { nav: forwarder.nav };
          } else if (forwarder.nav) {
            return { nav: forwarder.nav, algorithm: JSON.parse(forwarder.nav) };
          } else {
            return { nav: NONE_SELECTED };
          }
        }),
        takeUntil(this.destroyed),
      )
      .subscribe(activeForwarder$);

    // update forwarder cascade visibility
    combineLatest([activeIdentifier$, activeForwarder$])
      .pipe(
        map(([username, forwarder]) => {
          const showForwarder = !username.algorithm;
          const forwarderId =
            showForwarder && forwarder.algorithm && isForwarderExtensionId(forwarder.algorithm)
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
        distinctUntilChanged((prev, next) => {
          if (prev === null || next === null) {
            return false;
          } else {
            return isSameAlgorithm(prev.id, next.id);
          }
        }),
        takeUntil(this.destroyed),
      )
      .subscribe((algorithm) => {
        this.log.debug({ algorithm: algorithm?.id ?? null }, "algorithm selected");

        // update subjects within the angular zone so that the
        // template bindings refresh immediately
        this.zone.run(() => {
          this.maybeAlgorithm$.next(algorithm);
          if (algorithm) {
            this.onAlgorithm.next(toAlgorithmInfo(algorithm, this.i18nService));
          } else {
            this.onAlgorithm.next(null);
          }
        });
      });

    // assume the last-visible generator algorithm is the user's preferred one
    const preferences = await this.generatorService.preferences({ account$: this.account$ });
    this.algorithm$
      .pipe(withLatestFrom(preferences), takeUntil(this.destroyed))
      .subscribe(([algorithm, preference]) => {
        if (isEmailAlgorithm(algorithm.id)) {
          preference.email.algorithm = algorithm.id;
          preference.email.updated = new Date();
        } else if (isUsernameAlgorithm(algorithm.id)) {
          preference.username.algorithm = algorithm.id;
          preference.username.updated = new Date();
        } else {
          return;
        }

        this.log.info(
          { algorithm: algorithm.id, type: algorithm.type },
          "algorithm preferences updated",
        );
        preferences.next(preference);
      });

    preferences
      .pipe(
        map(({ email, username }) => {
          const usernamePref = email.updated > username.updated ? email : username;
          const forwarderPref = isForwarderExtensionId(usernamePref.algorithm)
            ? usernamePref
            : null;

          // inject drill-down flags
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
                algorithm: forwarderPref ? undefined : usernamePref.algorithm,
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
        this.log.debug(
          {
            username: username.selection,
            forwarder: forwarder.selection,
          },
          "navigation updated",
        );

        // update navigation; break subscription loop
        this.username.setValue(username.selection, { emitEvent: false });
        this.forwarder.setValue(forwarder.selection, { emitEvent: false });

        // update cascade visibility
        activeIdentifier$.next(username.active);
        activeForwarder$.next(forwarder.active);
      });

    // automatically regenerate when the algorithm switches if the algorithm
    // allows it; otherwise set a placeholder
    this.maybeAlgorithm$.pipe(takeUntil(this.destroyed)).subscribe((a) => {
      this.zone.run(() => {
        if (a?.capabilities?.autogenerate) {
          this.log.debug("autogeneration enabled");
          this.generate("autogenerate").catch((e: unknown) => {
            this.log.error(e as object, "a failure occurred during autogeneration");
          });
        } else {
          this.log.debug("autogeneration disabled; clearing generated credential");
          this.generatedCredential$.next(undefined);
        }
      });
    });

    this.log.debug("component initialized");
  }

  private announce(message: string) {
    this.ariaLive.announce(message).catch((e) => this.logService.error(e));
  }

  /** Lists the credential types supported by the component. */
  protected typeOptions$ = new BehaviorSubject<Option<string>[]>([]);

  /** Tracks the currently selected forwarder. */
  protected forwarderId$ = new BehaviorSubject<VendorId | null>(null);

  /** Lists the credential types supported by the component. */
  protected forwarderOptions$ = new BehaviorSubject<Option<string>[]>([]);

  /** Tracks forwarder control visibility */
  protected showForwarder$ = new BehaviorSubject<boolean>(false);

  /** tracks the currently selected algorithm; emits `null` when no algorithm selected */
  protected maybeAlgorithm$ = new ReplaySubject<AlgorithmMetadata | null>(1);

  /** tracks the last valid algorithm selection */
  protected algorithm$ = this.maybeAlgorithm$.pipe(
    filter((algorithm): algorithm is AlgorithmMetadata => !!algorithm),
  );

  /** Emits hint key for the currently selected credential type */
  protected credentialTypeHint$ = new ReplaySubject<string>(1);

  private readonly generatedCredential$ = new BehaviorSubject<GeneratedCredential | undefined>(
    undefined,
  );

  /** Emits the last generated value. */
  protected readonly value$ = this.generatedCredential$.pipe(
    map((generated) => generated?.credential ?? "-"),
  );

  /** Emits when a new credential is requested */
  private readonly generate$ = new Subject<GenerateRequest>();

  protected showAlgorithm$ = this.maybeAlgorithm$.pipe(
    combineLatestWith(this.showForwarder$),
    map(([algorithm, showForwarder]) => (showForwarder ? null : algorithm)),
  );

  /**
   * Emits the copy button aria-label respective of the selected credential type
   */
  protected credentialTypeCopyLabel$ = this.algorithm$.pipe(
    map(({ i18nKeys: { copyCredential } }) => translate(copyCredential, this.i18nService)),
  );

  /**
   * Emits the generate button aria-label respective of the selected credential type
   */
  protected credentialTypeGenerateLabel$ = this.algorithm$.pipe(
    map(({ i18nKeys: { generateCredential } }) => translate(generateCredential, this.i18nService)),
  );

  /**
   * Emits the copy credential toast respective of the selected credential type
   */
  protected credentialTypeLabel$ = this.algorithm$.pipe(
    map(({ i18nKeys: { credentialType } }) => translate(credentialType, this.i18nService)),
  );

  /** Identifies generator requests that were requested by the user */
  protected readonly USER_REQUEST = "user request";

  /** Request a new value from the generator
   * @param source a label used to trace generation request
   *  origin in the debugger.
   */
  protected async generate(source: string) {
    const algorithm = await firstValueFrom(this.algorithm$);
    const request: GenerateRequest = { source, algorithm: algorithm.id };
    if (this.website) {
      request.website = this.website;
    }

    this.log.debug(request, "generation requested");
    this.generate$.next(request);
  }

  private toOptions(algorithms: AlgorithmMetadata[]) {
    const options: Option<string>[] = algorithms.map((algorithm) => ({
      value: JSON.stringify(algorithm.id),
      label: translate(algorithm.i18nKeys.name, this.i18nService),
    }));

    return options;
  }

  private readonly destroyed = new Subject<void>();
  ngOnDestroy() {
    this.destroyed.next();
    this.destroyed.complete();

    // finalize subjects
    this.generate$.complete();
    this.generatedCredential$.complete();

    // finalize component bindings
    this.onGenerated.complete();

    this.log.debug("component destroyed");
  }
}
