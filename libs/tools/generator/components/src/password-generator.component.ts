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
import {
  BehaviorSubject,
  catchError,
  distinctUntilChanged,
  filter,
  firstValueFrom,
  map,
  ReplaySubject,
  Subject,
  takeUntil,
  withLatestFrom,
} from "rxjs";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  SemanticLogger,
  disabledSemanticLoggerProvider,
  ifEnabledSemanticLoggerProvider,
} from "@bitwarden/common/tools/log";
import { UserId } from "@bitwarden/common/types/guid";
import { ToastService, Option } from "@bitwarden/components";
import {
  CredentialGeneratorService,
  GeneratedCredential,
  AlgorithmInfo,
  GenerateRequest,
  isSameAlgorithm,
  CredentialAlgorithm,
  isPasswordAlgorithm,
  Algorithm,
  AlgorithmMetadata,
  Type,
  GeneratorProfile,
  Profile,
} from "@bitwarden/generator-core";
import { GeneratorHistoryService } from "@bitwarden/generator-history";

import { toAlgorithmInfo, translate } from "./util";

/** Options group for passwords */
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "tools-password-generator",
  templateUrl: "password-generator.component.html",
  standalone: false,
})
export class PasswordGeneratorComponent implements OnInit, OnChanges, OnDestroy {
  constructor(
    private generatorService: CredentialGeneratorService,
    private generatorHistoryService: GeneratorHistoryService,
    private toastService: ToastService,
    private i18nService: I18nService,
    private logService: LogService,
    private accountService: AccountService,
    private zone: NgZone,
    private ariaLive: LiveAnnouncer,
  ) {}

  /** exports algorithm symbols to the template */
  protected readonly Algorithm = Algorithm;

  /** Binds the component to a specific user's settings. When this input is not provided,
   * the form binds to the active user
   */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input()
  account: Account | null = null;

  protected account$ = new ReplaySubject<Account>(1);

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

  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input()
  profile: GeneratorProfile = Profile.account;

  /** Removes bottom margin, passed to downstream components */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input({ transform: coerceBooleanProperty })
  disableMargin = false;

  /** tracks the currently selected credential type */
  protected credentialType$ = new BehaviorSubject<CredentialAlgorithm | null>(null);

  /** Emits the last generated value. */
  protected readonly value$ = new BehaviorSubject<string>("");

  /** Emits when a new credential is requested */
  private readonly generate$ = new Subject<GenerateRequest>();

  /** Identifies generator requests that were requested by the user */
  protected readonly USER_REQUEST = "user request";

  /** Request a new value from the generator
   * @param requestor a label used to trace generation request
   *  origin in the debugger.
   */
  protected async generate(source: string) {
    const algorithm = await firstValueFrom(this.algorithm$);
    const request: GenerateRequest = { source, algorithm: algorithm.id, profile: this.profile };

    this.log.debug(request, "generation requested");
    this.generate$.next(request);
  }

  /** Tracks changes to the selected credential type
   * @param type the new credential type
   */
  protected onCredentialTypeChanged(type: CredentialAlgorithm) {
    // break subscription cycle
    if (this.credentialType$.value !== type) {
      this.zone.run(() => {
        this.credentialType$.next(type);
      });
    }
  }

  /** Emits credentials created from a generation request. */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output()
  readonly onGenerated = new EventEmitter<GeneratedCredential>();

  /** emits algorithm info when the selected algorithm changes */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output()
  readonly onAlgorithm = new EventEmitter<AlgorithmInfo>();

  async ngOnInit() {
    this.log = ifEnabledSemanticLoggerProvider(this.debug, this.logService, {
      type: "PasswordGeneratorComponent",
    });

    if (!this.account) {
      const account = await firstValueFrom(this.accountService.activeAccount$);
      if (!account) {
        this.log.panic("active account cannot be `null`.");
      }

      this.log.info({ userId: account.id }, "account not specified; using active account settings");
      this.account$.next(account);
    }

    this.generatorService
      .algorithms$("password", { account$: this.account$ })
      .pipe(
        map((algorithms) => this.toOptions(algorithms)),
        takeUntil(this.destroyed),
      )
      .subscribe(this.passwordOptions$);

    // wire up the generator
    this.generatorService
      .generate$({ on$: this.generate$, account$: this.account$ })
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
        withLatestFrom(this.account$, this.algorithm$),
        takeUntil(this.destroyed),
      )
      .subscribe(([generated, account, algorithm]) => {
        this.log.debug({ source: generated.source ?? null }, "credential generated");

        this.generatorHistoryService
          .track(account.id, generated.credential, generated.category, generated.generationDate)
          .catch((e: unknown) => {
            this.logService.error(e);
          });

        // update subjects within the angular zone so that the
        // template bindings refresh immediately
        this.zone.run(() => {
          if (generated.source === this.USER_REQUEST) {
            this.announce(translate(algorithm.i18nKeys.credentialGenerated, this.i18nService));
          }

          this.onGenerated.next(generated);
          this.value$.next(generated.credential);
        });
      });

    // assume the last-visible generator algorithm is the user's preferred one
    const preferences = await this.generatorService.preferences({ account$: this.account$ });
    this.credentialType$
      .pipe(
        filter((type) => !!type),
        withLatestFrom(preferences),
        takeUntil(this.destroyed),
      )
      .subscribe(([algorithm, preference]) => {
        if (isPasswordAlgorithm(algorithm)) {
          this.log.info({ algorithm, type: Type.password }, "algorithm preferences updated");
          preference.password.algorithm = algorithm;
          preference.password.updated = new Date();
        } else {
          return;
        }

        preferences.next(preference);
      });

    // update active algorithm
    preferences
      .pipe(
        map(({ password }) => this.generatorService.algorithm(password.algorithm)),
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
        this.log.debug({ algorithm: algorithm.id }, "algorithm selected");

        // update navigation
        this.onCredentialTypeChanged(algorithm.id);

        // update subjects within the angular zone so that the
        // template bindings refresh immediately
        this.zone.run(() => {
          this.maybeAlgorithm$.next(algorithm);
          this.onAlgorithm.next(toAlgorithmInfo(algorithm, this.i18nService));
        });
      });

    // generate on load unless the generator prohibits it
    this.maybeAlgorithm$.pipe(takeUntil(this.destroyed)).subscribe((a) => {
      this.zone.run(() => {
        if (a?.capabilities?.autogenerate) {
          this.log.debug("autogeneration enabled");
          this.generate("autogenerate").catch((e: unknown) => {
            this.log.error(e as object, "a failure occurred during autogeneration");
          });
        } else {
          this.log.debug("autogeneration disabled; clearing generated credential");
          this.value$.next("-");
        }
      });
    });

    this.log.debug("component initialized");
  }

  private announce(message: string) {
    this.ariaLive.announce(message).catch((e) => this.logService.error(e));
  }

  /** Lists the credential types supported by the component. */
  protected passwordOptions$ = new BehaviorSubject<Option<CredentialAlgorithm>[]>([]);

  /** Determines when the password/passphrase selector is visible. */
  protected showCredentialTypes$ = this.passwordOptions$.pipe(map((options) => options.length > 1));

  /** tracks the currently selected credential type */
  protected maybeAlgorithm$ = new ReplaySubject<AlgorithmMetadata>(1);

  /** tracks the last valid algorithm selection */
  protected algorithm$ = this.maybeAlgorithm$.pipe(
    filter((algorithm): algorithm is AlgorithmMetadata => !!algorithm),
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

  private toOptions(algorithms: AlgorithmMetadata[]) {
    const options: Option<CredentialAlgorithm>[] = algorithms.map((algorithm) => ({
      value: algorithm.id,
      label: translate(algorithm.i18nKeys.name, this.i18nService),
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
