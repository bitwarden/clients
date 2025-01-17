// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { LiveAnnouncer } from "@angular/cdk/a11y";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { Component, EventEmitter, Input, NgZone, OnDestroy, OnInit, Output } from "@angular/core";
import {
  BehaviorSubject,
  catchError,
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
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
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
} from "@bitwarden/generator-core";
import { GeneratorHistoryService } from "@bitwarden/generator-history";

/** Options group for passwords */
@Component({
  selector: "tools-password-generator",
  templateUrl: "password-generator.component.html",
})
export class PasswordGeneratorComponent implements OnInit, OnDestroy {
  constructor(
    private generatorService: CredentialGeneratorService,
    private generatorHistoryService: GeneratorHistoryService,
    private toastService: ToastService,
    private logService: LogService,
    private accountService: AccountService,
    private zone: NgZone,
    private ariaLive: LiveAnnouncer,
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
  protected credentialType$ = new BehaviorSubject<CredentialAlgorithm>(null);

  /** Emits the last generated value. */
  protected readonly value$ = new BehaviorSubject<string>("");

  /** Emits when the userId changes */
  protected readonly userId$ = new BehaviorSubject<UserId>(null);

  /** Emits when a new credential is requested */
  private readonly generate$ = new Subject<GenerateRequest>();

  /** Identifies generator requests that were requested by the user */
  protected readonly USER_REQUEST = "user request";

  /** Request a new value from the generator
   * @param requestor a label used to trace generation request
   *  origin in the debugger.
   */
  protected async generate(requestor: string) {
    this.generate$.next({ source: requestor });
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
        withLatestFrom(this.userId$, this.algorithm$),
        takeUntil(this.destroyed),
      )
      .subscribe(([generated, userId, algorithm]) => {
        this.generatorHistoryService
          .track(userId, generated.credential, generated.category, generated.generationDate)
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

    // update active algorithm
    preferences
      .pipe(
        map(({ password }) => this.generatorService.algorithm(password.algorithm)),
        distinctUntilChanged((prev, next) => isSameAlgorithm(prev?.id, next?.id)),
        takeUntil(this.destroyed),
      )
      .subscribe((algorithm) => {
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
          this.value$.next("-");
        } else {
          this.generate("autogenerate").catch((e: unknown) => this.logService.error(e));
        }
      });
    });
  }

  private announce(message: string) {
    this.ariaLive.announce(message).catch((e) => this.logService.error(e));
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
