import { Directive, EventEmitter, Input, NgZone, OnDestroy, OnInit, Output } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { BehaviorSubject, combineLatest, firstValueFrom, Subject } from "rxjs";
import { debounceTime, first, map, skipWhile, takeUntil } from "rxjs/operators";

import { PasswordGeneratorPolicyOptions } from "@bitwarden/common/admin-console/models/domain/password-generator-policy-options";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ToastService } from "@bitwarden/components";
import {
  GeneratorType,
  DefaultPasswordBoundaries as DefaultBoundaries,
} from "@bitwarden/generator-core";
import {
  PasswordGenerationServiceAbstraction,
  UsernameGenerationServiceAbstraction,
  UsernameGeneratorOptions,
  PasswordGeneratorOptions,
} from "@bitwarden/generator-legacy";

export class EmailForwarderOptions {
  name: string;
  value: string;
  validForSelfHosted: boolean;
}

@Directive()
export class GeneratorComponent implements OnInit, OnDestroy {
  @Input() comingFromAddEdit = false;
  @Input() type: GeneratorType | "";
  @Output() onSelected = new EventEmitter<string>();

  usernameGeneratingPromise: Promise<string>;
  typeOptions: any[];
  usernameTypeOptions: any[];
  subaddressOptions: any[];
  catchallOptions: any[];
  forwardOptions: EmailForwarderOptions[];
  usernameOptions: UsernameGeneratorOptions = { website: null };
  passwordOptions: PasswordGeneratorOptions = {};
  username = "-";
  password = "-";
  showOptions = false;
  avoidAmbiguous = false;
  enforcedPasswordPolicyOptions: PasswordGeneratorPolicyOptions;
  usernameWebsite: string = null;

  get passTypeOptions() {
    return this._passTypeOptions.filter((o) => !o.disabled);
  }
  private _passTypeOptions: { name: string; value: GeneratorType; disabled: boolean }[];

  private destroy$ = new Subject<void>();
  private isInitialized$ = new BehaviorSubject(false);

  // update screen reader minimum password length with 500ms debounce
  // so that the user isn't flooded with status updates
  private _passwordOptionsMinLengthForReader = new BehaviorSubject<number>(
    DefaultBoundaries.length.min,
  );
  protected passwordOptionsMinLengthForReader$ = this._passwordOptionsMinLengthForReader.pipe(
    map((val) => val || DefaultBoundaries.length.min),
    debounceTime(500),
  );

  private _password = new BehaviorSubject<string>("-");

  constructor(
    protected passwordGenerationService: PasswordGenerationServiceAbstraction,
    protected usernameGenerationService: UsernameGenerationServiceAbstraction,
    protected platformUtilsService: PlatformUtilsService,
    protected accountService: AccountService,
    protected i18nService: I18nService,
    protected logService: LogService,
    protected route: ActivatedRoute,
    protected ngZone: NgZone,
    private win: Window,
    protected toastService: ToastService,
  ) {
    this.typeOptions = [
      { name: i18nService.t("password"), value: "password" },
      { name: i18nService.t("username"), value: "username" },
    ];
    this._passTypeOptions = [
      { name: i18nService.t("password"), value: "password", disabled: false },
      { name: i18nService.t("passphrase"), value: "passphrase", disabled: false },
    ];
    this.usernameTypeOptions = [
      {
        name: i18nService.t("plusAddressedEmail"),
        value: "subaddress",
        desc: i18nService.t("plusAddressedEmailDesc"),
      },
      {
        name: i18nService.t("catchallEmail"),
        value: "catchall",
        desc: i18nService.t("catchallEmailDesc"),
      },
      {
        name: i18nService.t("forwardedEmail"),
        value: "forwarded",
        desc: i18nService.t("forwardedEmailDesc"),
      },
      { name: i18nService.t("randomWord"), value: "word" },
    ];
    this.subaddressOptions = [{ name: i18nService.t("random"), value: "random" }];
    this.catchallOptions = [{ name: i18nService.t("random"), value: "random" }];

    this.forwardOptions = [
      { name: "", value: "", validForSelfHosted: false },
      { name: "addy.io", value: "anonaddy", validForSelfHosted: true },
      { name: "DuckDuckGo", value: "duckduckgo", validForSelfHosted: false },
      { name: "Fastmail", value: "fastmail", validForSelfHosted: true },
      { name: "Firefox Relay", value: "firefoxrelay", validForSelfHosted: false },
      { name: "SimpleLogin", value: "simplelogin", validForSelfHosted: true },
      { name: "Forward Email", value: "forwardemail", validForSelfHosted: true },
    ].sort((a, b) => a.name.localeCompare(b.name));

    this._password.pipe(debounceTime(250)).subscribe((password) => {
      ngZone.run(() => {
        this.password = password;
      });
      this.passwordGenerationService.addHistory(this.password).catch((e) => {
        this.logService.error(e);
      });
    });
  }

  cascadeOptions(navigationType: GeneratorType = undefined, accountEmail: string) {
    this.avoidAmbiguous = !this.passwordOptions.ambiguous;

    if (!this.type) {
      if (navigationType) {
        this.type = navigationType;
      } else {
        this.type = this.passwordOptions.type === "username" ? "username" : "password";
      }
    }

    this.passwordOptions.type =
      this.passwordOptions.type === "passphrase" ? "passphrase" : "password";

    const overrideType = this.enforcedPasswordPolicyOptions.overridePasswordType ?? "";
    const isDisabled = overrideType.length
      ? (value: string, policyValue: string) => value !== policyValue
      : (_value: string, _policyValue: string) => false;
    for (const option of this._passTypeOptions) {
      option.disabled = isDisabled(option.value, overrideType);
    }

    if (this.usernameOptions.type == null) {
      this.usernameOptions.type = "word";
    }
    if (
      this.usernameOptions.subaddressEmail == null ||
      this.usernameOptions.subaddressEmail === ""
    ) {
      this.usernameOptions.subaddressEmail = accountEmail;
    }
    if (this.usernameWebsite == null) {
      this.usernameOptions.subaddressType = this.usernameOptions.catchallType = "random";
    } else {
      this.usernameOptions.website = this.usernameWebsite;
    }
  }

  async ngOnInit() {
    combineLatest([
      this.route.queryParams.pipe(first()),
      this.accountService.activeAccount$.pipe(first()),
      this.passwordGenerationService.getOptions$(),
      this.usernameGenerationService.getOptions$(),
    ])
      .pipe(
        map(([qParams, account, [passwordOptions, passwordPolicy], usernameOptions]) => ({
          navigationType: qParams.type as GeneratorType,
          accountEmail: account.email,
          passwordOptions,
          passwordPolicy,
          usernameOptions,
        })),
        takeUntil(this.destroy$),
      )
      .subscribe((options) => {
        this.passwordOptions = options.passwordOptions;
        this.enforcedPasswordPolicyOptions = options.passwordPolicy;
        this.usernameOptions = options.usernameOptions;

        this.cascadeOptions(options.navigationType, options.accountEmail);
        this._passwordOptionsMinLengthForReader.next(this.passwordOptions.minLength);

        if (this.regenerateWithoutButtonPress()) {
          this.regenerate().catch((e) => {
            this.logService.error(e);
          });
        }

        this.isInitialized$.next(true);
      });

    // once initialization is complete, `ngOnInit` should return.
    //
    // FIXME(#6944): if a sync is in progress, wait to complete until after
    // the sync completes.
    await firstValueFrom(
      this.isInitialized$.pipe(
        skipWhile((initialized) => !initialized),
        takeUntil(this.destroy$),
      ),
    );

    if (this.usernameWebsite !== null) {
      const websiteOption = { name: this.i18nService.t("websiteName"), value: "website-name" };
      this.subaddressOptions.push(websiteOption);
      this.catchallOptions.push(websiteOption);
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.isInitialized$.complete();
    this._passwordOptionsMinLengthForReader.complete();
  }

  async typeChanged() {
    await this.savePasswordOptions();
  }

  async regenerate() {
    if (this.type === "password") {
      await this.regeneratePassword();
    } else if (this.type === "username") {
      await this.regenerateUsername();
    }
  }

  async sliderChanged() {
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.savePasswordOptions();
    await this.passwordGenerationService.addHistory(this.password);
  }

  async onPasswordOptionsMinNumberInput($event: Event) {
    // `savePasswordOptions()` replaces the null
    this.passwordOptions.number = null;

    await this.savePasswordOptions();

    // fixes UI desync that occurs when minNumber has a fixed value
    // that is reset through normalization
    ($event.target as HTMLInputElement).value = `${this.passwordOptions.minNumber}`;
  }

  async setPasswordOptionsNumber($event: boolean) {
    this.passwordOptions.number = $event;
    // `savePasswordOptions()` replaces the null
    this.passwordOptions.minNumber = null;

    await this.savePasswordOptions();
  }

  async onPasswordOptionsMinSpecialInput($event: Event) {
    // `savePasswordOptions()` replaces the null
    this.passwordOptions.special = null;

    await this.savePasswordOptions();

    // fixes UI desync that occurs when minSpecial has a fixed value
    // that is reset through normalization
    ($event.target as HTMLInputElement).value = `${this.passwordOptions.minSpecial}`;
  }

  async setPasswordOptionsSpecial($event: boolean) {
    this.passwordOptions.special = $event;
    // `savePasswordOptions()` replaces the null
    this.passwordOptions.minSpecial = null;

    await this.savePasswordOptions();
  }

  async sliderInput() {
    await this.normalizePasswordOptions();
  }

  async savePasswordOptions() {
    // map navigation state into generator type
    const restoreType = this.passwordOptions.type;
    if (this.type === "username") {
      this.passwordOptions.type = this.type;
    }

    // save options
    await this.normalizePasswordOptions();
    await this.passwordGenerationService.saveOptions(this.passwordOptions);

    // restore the original format
    this.passwordOptions.type = restoreType;
  }

  async saveUsernameOptions() {
    await this.usernameGenerationService.saveOptions(this.usernameOptions);
    if (this.usernameOptions.type === "forwarded") {
      this.username = "-";
    }
  }

  async regeneratePassword() {
    this._password.next(
      await this.passwordGenerationService.generatePassword(this.passwordOptions),
    );
  }

  regenerateUsername() {
    return this.generateUsername();
  }

  async generateUsername() {
    try {
      this.usernameGeneratingPromise = this.usernameGenerationService.generateUsername(
        this.usernameOptions,
      );
      this.username = await this.usernameGeneratingPromise;
      if (this.username === "" || this.username === null) {
        this.username = "-";
      }
    } catch (e) {
      this.logService.error(e);
    }
  }

  copy() {
    const password = this.type === "password";
    const copyOptions = this.win != null ? { window: this.win } : null;
    this.platformUtilsService.copyToClipboard(
      password ? this.password : this.username,
      copyOptions,
    );
    this.toastService.showToast({
      variant: "info",
      title: null,
      message: this.i18nService.t(
        "valueCopied",
        this.i18nService.t(password ? "password" : "username"),
      ),
    });
  }

  select() {
    this.onSelected.emit(this.type === "password" ? this.password : this.username);
  }

  toggleOptions() {
    this.showOptions = !this.showOptions;
  }

  regenerateWithoutButtonPress() {
    return this.type !== "username" || this.usernameOptions.type !== "forwarded";
  }

  private async normalizePasswordOptions() {
    // Application level normalize options dependent on class variables
    this.passwordOptions.ambiguous = !this.avoidAmbiguous;

    if (
      !this.passwordOptions.uppercase &&
      !this.passwordOptions.lowercase &&
      !this.passwordOptions.number &&
      !this.passwordOptions.special
    ) {
      this.passwordOptions.lowercase = true;
      if (this.win != null) {
        const lowercase = this.win.document.querySelector("#lowercase") as HTMLInputElement;
        if (lowercase) {
          lowercase.checked = true;
        }
      }
    }

    await this.passwordGenerationService.enforcePasswordGeneratorPoliciesOnOptions(
      this.passwordOptions,
    );
  }
}
