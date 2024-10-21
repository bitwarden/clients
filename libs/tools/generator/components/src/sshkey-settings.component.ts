import { OnInit, Input, Output, EventEmitter, Component, OnDestroy } from "@angular/core";
import { FormBuilder } from "@angular/forms";
import { BehaviorSubject, takeUntil, Subject, skip, map, combineLatest } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { UserId } from "@bitwarden/common/types/guid";
import { Generators, CredentialGeneratorService } from "@bitwarden/generator-core";

import { SshKeyGenerationOptions } from "../../core/src/types/sshkey-generation-options";

import { completeOnAccountSwitch } from "./util";

const Controls = Object.freeze({
  keyAlgorithm: "keyAlgorithm",
  bits: "bits",
});

/** Options group for passwords */
@Component({
  selector: "tools-sshkey-settings",
  templateUrl: "sshkey-settings.component.html",
})
export class SshKeySettingsComponent implements OnInit, OnDestroy {
  /** Instantiates the component
   *  @param accountService queries user availability
   *  @param generatorService settings and policy logic
   *  @param formBuilder reactive form controls
   */
  constructor(
    private formBuilder: FormBuilder,
    private generatorService: CredentialGeneratorService,
    private accountService: AccountService,
    private i18nService: I18nService,
  ) {}

  /** Binds the password component to a specific user's settings.
   *  When this input is not provided, the form binds to the active
   *  user
   */
  @Input()
  userId: UserId | null;

  /** When `true`, an options header is displayed by the component. Otherwise, the header is hidden. */
  @Input()
  showHeader: boolean = true;

  /** Number of milliseconds to wait before accepting user input. */
  @Input()
  waitMs: number = 100;

  /** Emits settings updates and completes if the settings become unavailable.
   * @remarks this does not emit the initial settings. If you would like
   *   to receive live settings updates including the initial update,
   *   use `CredentialGeneratorService.settings$(...)` instead.
   */
  @Output()
  readonly onUpdated = new EventEmitter<{
    algorithm: "ed25519" | "rsa";
    settings: SshKeyGenerationOptions;
  }>();

  protected settings = this.formBuilder.group({
    [Controls.keyAlgorithm]: ["ed25519"],
    [Controls.bits]: [Generators.ed25519.settings.initial.bits],
  });

  algorithmOptions: { name: string; value: string }[] = [];

  // FIXME: This should be provided by a service so it can be target by a policy
  rsaKeyLengths: {
    name: string;
    value: number;
  }[] = [
    { name: "2048 Bit", value: 2048 },
    { name: "3072 Bit", value: 3072 },
    { name: "4096 Bit", value: 4096 },
  ];

  async ngOnInit() {
    this.algorithmOptions = [
      { name: this.i18nService.t("sshKeyAlgorithmED25519"), value: "ed25519" },
      { name: this.i18nService.t("sshKeyAlgorithmRSA"), value: "rsa" },
    ];

    const singleUserId$ = this.singleUserId$();

    const rsaSettings = await this.generatorService.settings(Generators.rsa, { singleUserId$ });
    const ed25519Settings = await this.generatorService.settings(Generators.ed25519, {
      singleUserId$,
    });

    const settings = combineLatest([
      this.settings.controls[Controls.keyAlgorithm].valueChanges,
      rsaSettings,
      ed25519Settings,
    ]).pipe(
      map(([algorithm, rsa, ed25519]) => {
        return algorithm == "rsa"
          ? {
              algorithm,
              settings: {
                keyAlgorithm: algorithm,
                bits: rsa.bits,
              } as SshKeyGenerationOptions,
            }
          : {
              algorithm,
              settings: {
                keyAlgorithm: algorithm,
                bits: ed25519.bits,
              } as SshKeyGenerationOptions,
            };
      }),
    );

    // bind settings to the UI
    settings.pipe(takeUntil(this.destroyed$)).subscribe((s) => {
      // skips reactive event emissions to break a subscription cycle
      this.settings.patchValue(
        { bits: s.settings.bits, keyAlgorithm: s.algorithm },
        { emitEvent: false },
      );
    });

    // `onUpdated` depends on `settings` because the UserStateSubject is asynchronous;
    // subscribing directly to `this.settings.valueChanges` introduces a race condition.
    // skip the first emission because it's the initial value, not an update.
    settings.pipe(skip(1), takeUntil(this.destroyed$)).subscribe(this.onUpdated);

    this.settings.valueChanges.pipe(takeUntil(this.destroyed$)).subscribe((v) => {
      if (v.keyAlgorithm == "rsa") {
        rsaSettings.next({
          bits: v.bits,
        });
      } else {
        ed25519Settings.next({
          bits: v.bits,
        });
      }
    });
  }

  private singleUserId$() {
    // FIXME: this branch should probably scan for the user and make sure
    // the account is unlocked
    if (this.userId) {
      return new BehaviorSubject(this.userId as UserId).asObservable();
    }

    return this.accountService.activeAccount$.pipe(
      completeOnAccountSwitch(),
      takeUntil(this.destroyed$),
    );
  }

  private readonly destroyed$ = new Subject<void>();
  ngOnDestroy(): void {
    this.destroyed$.complete();
  }
}
