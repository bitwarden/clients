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
import {
  BehaviorSubject,
  catchError,
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
  Generators,
  GeneratedCredential,
  CredentialAlgorithm,
  isPasswordAlgorithm,
  AlgorithmInfo,
  isSameAlgorithm,
  GenerateRequest,
  CredentialCategories,
} from "@bitwarden/generator-core";
import { GeneratorHistoryService } from "@bitwarden/generator-history";

/** Options group for passwords */
@Component({
  selector: "tools-password-generator",
  templateUrl: "password-generator.component.html",
})
export class PasswordGeneratorComponent implements OnInit, OnChanges, OnDestroy {
  constructor(
    private generatorService: CredentialGeneratorService,
    private generatorHistoryService: GeneratorHistoryService,
    private toastService: ToastService,
    private logService: LogService,
    private accountService: AccountService,
    private zone: NgZone,
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

  /** Removes bottom margin, passed to downstream components */
  @Input({ transform: coerceBooleanProperty }) disableMargin = false;

  /** tracks the currently selected credential type */
  protected credentialType$ = new BehaviorSubject<CredentialAlgorithm>(null);

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
    this.log.debug({ source }, "generation requested");

    this.generate$.next({ source });
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
  @Output()
  readonly onGenerated = new EventEmitter<GeneratedCredential>();

  /** emits algorithm info when the selected algorithm changes */
  @Output()
  readonly onAlgorithm = new EventEmitter<AlgorithmInfo>();

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
      .algorithms$("password", { account$: this.account$ })
      .pipe(
        map((algorithms) => this.toOptions(algorithms)),
        takeUntil(this.destroyed),
      )
      .subscribe(this.passwordOptions$);

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
          this.log.info(
            { algorithm, category: CredentialCategories.password },
            "algorithm preferences updated",
          );
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
        distinctUntilChanged((prev, next) => isSameAlgorithm(prev?.id, next?.id)),
        takeUntil(this.destroyed),
      )
      .subscribe((algorithm) => {
        this.log.debug(algorithm, "algorithm selected");

        // update navigation
        this.onCredentialTypeChanged(algorithm.id);

        // update subjects within the angular zone so that the
        // template bindings refresh immediately
        this.zone.run(() => {
          this.algorithm$.next(algorithm);
          this.onAlgorithm.next(algorithm);
        });
      });

    // generate on load unless the generator prohibits it
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

  private announce(message: string) {
    this.ariaLive.announce(message).catch((e) => this.logService.error(e));
  }

  private typeToGenerator$(algorithm: CredentialAlgorithm) {
    const dependencies = {
      on$: this.generate$,
      account$: this.account$,
    };

    this.log.debug({ algorithm }, "constructing generation stream");

    switch (algorithm) {
      case "password":
        return this.generatorService.generate$(Generators.password, dependencies);

      case "passphrase":
        return this.generatorService.generate$(Generators.passphrase, dependencies);
      default:
        this.log.panic({ algorithm }, `Invalid generator type: "${algorithm}"`);
    }
  }

  /** Lists the credential types supported by the component. */
  protected passwordOptions$ = new BehaviorSubject<Option<CredentialAlgorithm>[]>([]);

  /** tracks the currently selected credential type */
  protected algorithm$ = new ReplaySubject<AlgorithmInfo>(1);

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

  private toOptions(algorithms: AlgorithmInfo[]) {
    const options: Option<CredentialAlgorithm>[] = algorithms.map((algorithm) => ({
      value: algorithm.id,
      label: algorithm.name,
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
