import { coerceBooleanProperty } from "@angular/cdk/coercion";
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
import { IntegrationId } from "@bitwarden/common/tools/integration";
import { UserId } from "@bitwarden/common/types/guid";
import { Option } from "@bitwarden/components/src/select/option";
import {
  AlgorithmInfo,
  CredentialAlgorithm,
  CredentialGeneratorService,
  EmailAlgorithm,
  ForwarderIntegration,
  GeneratedCredential,
  Generators,
  getForwarderConfiguration,
  isEmailAlgorithm,
  isForwarderIntegration,
  isUsernameAlgorithm,
  toCredentialGeneratorConfiguration,
  UsernameAlgorithm,
} from "@bitwarden/generator-core";

const FORWARDER = "forwarder";
type UsernameNavValue = UsernameAlgorithm | EmailAlgorithm | typeof FORWARDER;

const NONE_SELECTED = "none";
type ForwarderNavValue = ForwarderIntegration | typeof NONE_SELECTED;

/** Component that generates usernames and emails */
@Component({
  selector: "tools-username-generator",
  templateUrl: "username-generator.component.html",
})
export class UsernameGeneratorComponent implements OnInit, OnDestroy {
  /** Instantiates the username generator
   *  @param generatorService generates credentials; stores preferences
   *  @param i18nService localizes generator algorithm descriptions
   *  @param accountService discovers the active user when one is not provided
   *  @param zone detects generator settings updates originating from the generator services
   *  @param formBuilder binds reactive form
   */
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

  /** Removes bottom margin from internal elements */
  @Input({ transform: coerceBooleanProperty }) disableMargin = false;

  /** Tracks the selected generation algorithm */
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
          usernameOptions.push({ value: FORWARDER, label: this.i18nService.t("forwarder") });

          const forwarders = algorithms.filter((a) => isForwarderIntegration(a.id));
          const forwarderOptions = this.toOptions(forwarders) as Option<ForwarderNavValue>[];
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
    this.username.valueChanges
      .pipe(
        switchMap((username) => {
          if (username.nav === FORWARDER) {
            return concat(of(this.forwarder.value), this.forwarder.valueChanges);
          } else {
            return of(username as { nav: CredentialAlgorithm });
          }
        }),
        map((forwarder) => {
          if (forwarder.nav === NONE_SELECTED) {
            return { nav: null };
          } else {
            return forwarder as { nav: CredentialAlgorithm };
          }
        }),
        filter(({ nav }) => !!nav),
        withLatestFrom(preferences),
        takeUntil(this.destroyed),
      )
      .subscribe(([{ nav: algorithm }, preference]) => {
        if (isEmailAlgorithm(algorithm)) {
          preference.email.algorithm = algorithm;
          preference.email.updated = new Date();
        } else if (isUsernameAlgorithm(algorithm)) {
          preference.username.algorithm = algorithm;
          preference.username.updated = new Date();
        } else {
          return;
        }

        preferences.next(preference);
      });

    // populate the form with the user's preferences to kick off interactivity
    preferences.pipe(takeUntil(this.destroyed)).subscribe(({ email, username }) => {
      // the last preference set by the user "wins"
      const forwarderPref = isForwarderIntegration(email.algorithm) ? email : null;
      const usernamePref = email.updated > username.updated ? email : username;

      // inject drilldown flags
      const forwarderNav = forwarderPref
        ? (forwarderPref.algorithm as ForwarderIntegration)
        : NONE_SELECTED;
      const userNav = forwarderPref ? FORWARDER : (usernamePref.algorithm as UsernameAlgorithm);

      // update navigation; break subscription loop
      this.username.setValue({ nav: userNav }, { emitEvent: false });
      this.forwarder.setValue({ nav: forwarderNav }, { emitEvent: false });

      // load selected algorithm metadata
      const algorithm = this.generatorService.algorithm(usernamePref.algorithm);

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
    }

    if (isForwarderIntegration(type)) {
      const forwarder = getForwarderConfiguration(type.forwarder);
      const configuration = toCredentialGeneratorConfiguration(forwarder);
      return this.generatorService.generate$(configuration, dependencies);
    }

    throw new Error(`Invalid generator type: "${type}"`);
  }

  /** Lists the credential types supported by the component. */
  protected typeOptions$ = new BehaviorSubject<Option<UsernameNavValue>[]>([]);

  /** Lists the credential types supported by the component. */
  protected forwarderOptions$ = new BehaviorSubject<Option<ForwarderNavValue>[]>([]);

  /** tracks the currently selected credential type */
  protected algorithm$ = new ReplaySubject<AlgorithmInfo>(1);

  /** Tracks the currently selected forwarder. */
  protected forwarderId$ = new BehaviorSubject<IntegrationId>(null);

  /** Emits hint key for the currently selected credential type */
  protected credentialTypeHint$ = new ReplaySubject<string>(1);

  /** Emits the last generated value. */
  protected readonly value$ = new BehaviorSubject<string>("");

  /** Emits when the userId changes */
  protected readonly userId$ = new BehaviorSubject<UserId>(null);

  /** Emits when a new credential is requested */
  protected readonly generate$ = new Subject<void>();

  private toOptions(algorithms: AlgorithmInfo[]) {
    const options: Option<CredentialAlgorithm>[] = algorithms.map((algorithm) => ({
      value: algorithm.id,
      label: this.i18nService.t(algorithm.name),
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
